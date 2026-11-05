// Loaded with --import: turns signal names sent over IPC into process signal
// events. On Windows, ChildProcess.kill() ends a process without running its
// signal handlers, so tests deliver shutdown signals this way on every platform.
process.on('message', (signal) => {
  if (signal === 'SIGINT' || signal === 'SIGTERM') process.emit(signal, signal);
});
// The IPC channel must not keep the process alive after shutdown.
process.channel?.unref();
