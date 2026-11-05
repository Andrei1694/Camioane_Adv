// Loaded with --import so tests can drive admin:bootstrap through pipes: the
// script only runs in a terminal. readline still parses keys as a terminal.
process.stdin.isTTY = true;
process.stdout.isTTY = true;
