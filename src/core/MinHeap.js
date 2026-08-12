export class MinHeap {
  #compare;
  #values = [];

  constructor(compare) {
    if (typeof compare !== "function") {
      throw new TypeError("MinHeap requires a comparison function.");
    }
    this.#compare = compare;
  }

  get size() {
    return this.#values.length;
  }

  peek() {
    return this.#values[0] ?? null;
  }

  push(value) {
    this.#values.push(value);
    let index = this.#values.length - 1;

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.#compare(this.#values[parentIndex], value) <= 0) {
        break;
      }
      this.#values[index] = this.#values[parentIndex];
      index = parentIndex;
    }

    this.#values[index] = value;
  }

  pop() {
    if (this.#values.length === 0) {
      return null;
    }

    const firstValue = this.#values[0];
    const lastValue = this.#values.pop();
    if (this.#values.length === 0) {
      return firstValue;
    }

    let index = 0;
    while (true) {
      const leftIndex = index * 2 + 1;
      const rightIndex = leftIndex + 1;
      if (leftIndex >= this.#values.length) {
        break;
      }

      let smallestChildIndex = leftIndex;
      if (
        rightIndex < this.#values.length &&
        this.#compare(this.#values[rightIndex], this.#values[leftIndex]) < 0
      ) {
        smallestChildIndex = rightIndex;
      }

      if (this.#compare(lastValue, this.#values[smallestChildIndex]) <= 0) {
        break;
      }

      this.#values[index] = this.#values[smallestChildIndex];
      index = smallestChildIndex;
    }

    this.#values[index] = lastValue;
    return firstValue;
  }

  clear() {
    this.#values.length = 0;
  }
}
