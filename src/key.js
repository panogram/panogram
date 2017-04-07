import { isNil, any, values } from 'ramda';


export class Key {
  constructor() {
    // which parts of the key are shown by default
    this.shown = {
      variants: false,
      dataPresence: false,
      focused: true,
      proband: false,
      sex: true,
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
    if (any(values(this.show))) {
      let legendContainer = jquery('#legend-container');
      if (!legendContainer.length) {
        legendContainer = jquery(`<div class="legend-container" id="legend-container"></div>`);
        editor.getWorkspace().getWorkArea().insert(legendContainer);
      }
      const newKey = jquery(this.template());
      const key = legendContainer.find('.legend-box.key');
      if (key.length) {
        key.replaceWith(newKey);
      } else {
        legendContainer.append(newKey);
      }
    }
  }
  template() {
    const {
      focused: showFocused,
      proband: showProband,
      sex: showSex,
      variants: showVariants,
      dataPresence: showDataPresence
    } = this.shown;

    const focused = showFocused ?
      `<div><b style="color:blue">Blue line:</b> current patient</div>`:
      ``;
    const proband = showProband ?
      `<div><b>Arrow:</b> proband</div>` :
      ``;
    const sex = showSex ?
      `<div><b>Sex:</b> Square - Male, Circle - Female</div>`:
       ``;
    const dot = `<i style="line-height: 15px; font-size:0.5rem" class="fa fa-circle"/>`;
    const wrapper = content => `<span style="inline-block; width: 1rem">${content}</sapn>`;
    const hetrozygous = wrapper(dot);
    const homozygous = wrapper(`${dot} ${dot}`);
    const variantsKey = showVariants ?
     `<div><b>Variant zygosity:</b></br>
        <span style="display: inline-block; width: 5rem; padding-left:0.8rem;">homozygous</span>${homozygous}</div>
        <span style="display: inline-block; width: 5rem; padding-left:0.8rem;">hetrozygous</span>${hetrozygous}</div>
      </div>` :
      ``;
    const dataPresenceKey = '';

    return `
      <div class="legend-box key">
        <h2 class="legend-title">Key</h2>
        ${sex}
        ${focused}
        ${proband}
        ${variantsKey}
        ${dataPresenceKey}
      </div>
    `;
  }
}
