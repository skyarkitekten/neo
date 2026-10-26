---
description:
  'Run one design-thinking activity directly: /neo-design <activity>. With no argument, shows the activity menu and a
  recommendation. Short form of the neo-design-thinking skill.'
argument-hint: '[activity] — e.g. persona, journey-map, blueprint; omit for the menu'
disable-model-invocation: true
---

Invoke the `neo-design-thinking` skill and follow its **Commands** section. Pass the text the user typed after
`/neo-design` to the skill verbatim as its arguments; if they typed nothing, pass no arguments.

Do not resolve the activity, show a menu, or skip any step yourself — this command is only a short address for that
skill. All dispatch rules (the menu, aliases, unknown sub-commands, and the `docs/design/` pre-flight) live in the
skill, so `/neo-design <activity>` and `/neo-design-thinking <activity>` behave identically.
