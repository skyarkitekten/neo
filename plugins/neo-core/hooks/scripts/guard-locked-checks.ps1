<#
.SYNOPSIS
  Copilot CLI preToolUse hook that keeps a builder from editing pre-registered checks.
  The Windows / PowerShell sibling of guard-locked-checks.sh. Keep the two in step.

.NOTES
  DRAFT, OPT-IN, NOT REGISTERED in hooks/hooks.json. See docs/contributing/guides/enforcement.md
  § Locked checks and docs/contributing/design/verification-loop.md.

  Lock marker (in the git dir, never committed):
    $(git rev-parse --git-path neo-check-lock)
    {"lock_sha": "<sha>", "branch": "<branch>", "paths": ["tests/checkout/", "contracts/*.dfy"]}
  A path ending in "/" is a directory, a path with * ? [ is a glob, anything else is an exact file.
  No marker, or a different branch, means allow.

  While the lock is active it denies edit/create/apply_patch on locked paths, shell commands that
  look like writes to them, `git commit` with locked paths dirty, `git push` when <lock_sha>..HEAD
  changes them, and any shell command that names the marker.

  A speed bump, not a control. The authoritative checks are Neo Validator's integrity audit and
  a CI job that repeats it. Always exits 0; unparseable input allows with a stderr warning.
  Relaxation (a human-recorded lock amendment): NEO_CHECK_LOCK=0, or delete the marker.
#>

$ErrorActionPreference = 'Stop'

function Allow { exit 0 }
function Warn([string]$Msg) { [Console]::Error.WriteLine("Neo guard-locked-checks: $Msg; allowing."); exit 0 }
function Deny([string]$Reason) {
    Write-Output ([ordered]@{ permissionDecision = 'deny'; permissionDecisionReason = $Reason } | ConvertTo-Json -Compress)
    exit 0
}

if (@('0', 'off', 'false', 'no') -contains "$($env:NEO_CHECK_LOCK)".ToLowerInvariant()) { Allow }

try {
    $raw = [Console]::In.ReadToEnd()
    try { $data = $raw | ConvertFrom-Json } catch { Warn 'unparseable preToolUse payload' }
    if ($null -eq $data -or $data -isnot [psobject]) { Warn 'unparseable preToolUse payload' }

    $tool = "$(if ($data.toolName) { $data.toolName } else { $data.tool_name })"
    $toolArgs = if ($null -ne $data.toolArgs) { $data.toolArgs } else { $data.tool_input }
    if ($toolArgs -is [string]) { try { $toolArgs = $toolArgs | ConvertFrom-Json } catch { } }

    $cwd = if ($data.cwd) { "$($data.cwd)" } else { (Get-Location).Path }
    if (-not (Test-Path -LiteralPath $cwd -PathType Container)) { Allow }

    function Invoke-Git([string]$Dir, [string[]]$GitArgs) {
        $out = & git -C $Dir @GitArgs 2>$null
        if ($LASTEXITCODE -ne 0) { return $null }
        return (($out | Out-String).Trim())
    }

    $top = Invoke-Git $cwd @('rev-parse', '--show-toplevel')
    $marker = Invoke-Git $cwd @('rev-parse', '--git-path', 'neo-check-lock')
    if (-not $top -or -not $marker) { Allow }
    if (-not [System.IO.Path]::IsPathRooted($marker)) { $marker = Join-Path $cwd $marker }
    if (-not (Test-Path -LiteralPath $marker -PathType Leaf)) { Allow }

    try { $lock = Get-Content -LiteralPath $marker -Raw | ConvertFrom-Json } catch { Warn "lock marker $marker is unreadable" }
    $paths = @($lock.paths | Where-Object { $_ } | ForEach-Object { ("$_" -replace '\\', '/') -replace '^\./', '' })
    $lockSha = "$($lock.lock_sha)"
    $lockBranch = "$($lock.branch)"
    if ($paths.Count -eq 0) { Allow }
    if ($lockBranch -and (Invoke-Git $cwd @('rev-parse', '--abbrev-ref', 'HEAD')) -ne $lockBranch) { Allow }

    # GetFullPath doesn't resolve symlinks (macOS /var -> /private/var), so try the root as seen
    # from cwd first, then git's canonical top level.
    $cdup = Invoke-Git $cwd @('rev-parse', '--show-cdup')
    $roots = @([System.IO.Path]::GetFullPath((Join-Path $cwd "$cdup")), [System.IO.Path]::GetFullPath($top))
    function Rel([string]$P) {
        $P = $P.Trim().Trim("'", '"')
        if (-not $P) { return '' }
        $abs = [System.IO.Path]::GetFullPath($(if ([System.IO.Path]::IsPathRooted($P)) { $P } else { Join-Path $cwd $P }))
        foreach ($root in $roots) {
            $r = [System.IO.Path]::GetRelativePath($root, $abs) -replace '\\', '/'
            if (-not ($r.StartsWith('../') -or $r -eq '..' -or [System.IO.Path]::IsPathRooted($r))) { return $r }
        }
        return ''
    }
    function IsLocked([string]$R) {
        if (-not $R) { return $false }
        foreach ($p in $paths) {
            if ($p.EndsWith('/')) { if ($R -eq $p.TrimEnd('/') -or $R.StartsWith($p)) { return $true } }
            elseif ($p.IndexOfAny([char[]]'*?[') -ge 0) {
                $wc = [System.Management.Automation.WildcardPattern]::new($p)
                if ($wc.IsMatch($R)) { return $true }
            }
            elseif ($R -eq $p) { return $true }
        }
        return $false
    }
    function Hits([string[]]$Names) { @($Names | Where-Object { $_ } | ForEach-Object { $_ -replace '\\', '/' } | Where-Object { IsLocked $_ } | Sort-Object -Unique) }

    $lockRef = if ($lockSha) { $lockSha.Substring(0, [Math]::Min(12, $lockSha.Length)) } else { 'the lock' }
    function Reason([string]$What) {
        "Neo check lock: $What is a locked check (pre-registered at $lockRef). The builder must make " +
        'locked checks pass, not change them. If the check itself is wrong, stop and escalate ' +
        'for a human-approved lock amendment (see the neo-evidence-manifest skill).'
    }

    $editTools = @('edit', 'create', 'write', 'str_replace_editor', 'str_replace_based_edit_tool', 'apply_patch',
        'multi_edit', 'multiedit', 'notebookedit', 'write_file', 'edit_file')
    $shellTools = @('bash', 'powershell', 'shell', 'run_in_terminal')
    $t = $tool.ToLowerInvariant()

    if ($editTools -contains $t) {
        $targets = [System.Collections.Generic.List[string]]::new()
        if ($toolArgs -is [psobject] -and $toolArgs -isnot [string]) {
            foreach ($k in 'path', 'file_path', 'filePath', 'target_file', 'filename') {
                if ($toolArgs.$k -is [string]) { $targets.Add($toolArgs.$k) }
            }
            $blob = $toolArgs | ConvertTo-Json -Compress -Depth 10
            $blob = [regex]::Unescape($blob)
        } else { $blob = "$toolArgs" }
        foreach ($m in [regex]::Matches($blob, '\*\*\* (?:Add|Update|Delete) File: ([^\r\n]+)')) { $targets.Add($m.Groups[1].Value) }
        foreach ($m in [regex]::Matches($blob, '\*\*\* Move to: ([^\r\n]+)')) { $targets.Add($m.Groups[1].Value) }
        $bad = @($targets | ForEach-Object { Rel $_ } | Where-Object { IsLocked $_ } | Sort-Object -Unique)
        if ($bad.Count -gt 0) { Deny (Reason ($bad -join ', ')) }
        Allow
    }

    if ($shellTools -notcontains $t) { Allow }

    $cmd = ''
    if ($toolArgs -is [string]) { $cmd = $toolArgs }
    elseif ($null -ne $toolArgs) {
        foreach ($k in 'command', 'script', 'cmd', 'commandLine', 'input') {
            if ($toolArgs.$k -is [string] -and $toolArgs.$k) { $cmd = $toolArgs.$k; break }
        }
    }
    if (-not $cmd) { Allow }
    $norm = ($cmd -split '\s+' | Where-Object { $_ }) -join ' '

    if ($norm.Contains('neo-check-lock')) {
        Deny 'Neo check lock: the lock marker is human-managed. Agents may not touch it from the shell. Ask a human to amend or lift the lock.'
    }

    if ($norm -match '(^|[;&|(\s])git\s+commit\b') {
        $changed = @((Invoke-Git $top @('diff', '--name-only', 'HEAD')) -split "`n") + @((Invoke-Git $top @('diff', '--cached', '--name-only')) -split "`n")
        $bad = Hits $changed
        if ($bad.Count -gt 0) { Deny ((Reason ($bad -join ', ')) + ' Revert them (they are locked) before committing.') }
    }

    if ($lockSha -and $norm -match '(^|[;&|(\s])git\s+push\b') {
        $bad = Hits ((Invoke-Git $top @('diff', '--name-only', $lockSha, 'HEAD')) -split "`n")
        if ($bad.Count -gt 0) { Deny ((Reason ($bad -join ', ')) + ' Commits since the lock changed them; this branch would carry moved goalposts.') }
    }

    $writes = '(^|[;&|(\s])(rm|mv|cp|truncate|tee|touch|dd|install|ln|chmod)\s' +
        '|\b(sed|perl|ruby)\s+(-\w*\s+)*-i' +
        '|\bgit\s+(rm|mv|checkout|restore|apply|stash|reset|clean)\b' +
        '|(^|[^0-9&>])>{1,2}\s*[^\s&]' +
        '|\b(Set-Content|Add-Content|Out-File|Remove-Item|Move-Item|Copy-Item|New-Item|Rename-Item|Clear-Content)\b'
    if ($norm -match $writes) {
        $mentioned = @()
        foreach ($p in $paths) {
            $stem = $p.TrimEnd('/')
            $i = $stem.IndexOfAny([char[]]'*?[')
            if ($i -ge 0) { $stem = $stem.Substring(0, $i).TrimEnd('/') }
            if ($stem -and $norm.Contains($stem)) { $mentioned += $p }
        }
        if ($mentioned.Count -gt 0) {
            Deny ((Reason (($mentioned | Sort-Object) -join ', ')) + ' This command looks like it writes to a locked path.')
        }
    }
    Allow
}
catch {
    [Console]::Error.WriteLine("Neo guard-locked-checks: guard crashed ($($_.Exception.Message)); allowing.")
    exit 0
}
