export class CommandQueue {
  constructor() {
    this.sequence = 0;
    this.items = [];
  }

  enqueue(type, payload = {}, tick = 0) {
    if (typeof type !== 'string' || !type) throw new TypeError('Command type is required');
    const command = Object.freeze({ type, payload, tick, sequence: this.sequence });
    this.sequence += 1;
    this.items.push(command);
    return command;
  }

  drainThrough(tick = Number.POSITIVE_INFINITY) {
    const ready = [];
    const pending = [];
    for (const command of this.items) {
      (command.tick <= tick ? ready : pending).push(command);
    }
    this.items = pending;
    ready.sort((left, right) => left.tick - right.tick || left.sequence - right.sequence);
    return ready;
  }

  clear() {
    this.items.length = 0;
  }
}

export default CommandQueue;
