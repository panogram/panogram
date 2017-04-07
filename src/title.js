
export class Title {
  constructor(text) {
    this.text = text;
  }
  draw() {
    let title = jquery('#work-area #legend-container #title');
    if (title.length) {
      title.text(this.text);
    } else {
      let container = jquery('#work-area #legend-container');
      if (!container.length) {
        container = jquery('<div id="legend-container"></div>');
        jquery('#work-area').append(container);
      }
      title = jquery(`<h2 id="title">${this.text}</h2>`);
      container.prepend(title);
    }
  }
}
