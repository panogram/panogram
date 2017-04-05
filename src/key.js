import { isNil } from 'ramda';

export class Key {
  constructor() {
    // which parts of the key are shown by default
    this.shown = {
      variants: false,
      dataPresence: true,
    };
  }
  showElement(name) {
    if (isNil(name)) throw new Error('you must specify which part of the key you want to show');
    // if specified part of key is not shown then show it.
    if (!this.shown[name]) {
      this.shown[name] = true;
      this.draw();
    }
  }
  hideElement(name){
    if (isNil(name)) throw new Error('you must specify which part of the key you want to hide');
    // if specified part of key is shown then hide it.
    if (this.shown[name]) {
      this.shown[name] = true;
      this.draw();
    }
  }
  draw() {
    if (this.shown.variants) {
      console.log('DRAWING VARIANTS');
    }
    if (this.shown.dataPresence) {
      console.log('DRAWING dataPresence');
    }
  }
}
