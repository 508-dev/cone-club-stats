import { mount, unmount } from 'svelte';

export function bindComponentPopup(marker, component, props) {
  let instance;
  const clear = () => {
    if (instance) unmount(instance);
    instance = null;
  };
  marker.bindPopup(() => {
    clear();
    const target = document.createElement('div');
    instance = mount(component, { target, props });
    return target;
  }, { className: 'accident-popup', maxWidth: 280, minWidth: 220,
    autoPanPaddingTopLeft: [10, 85], autoPanPaddingBottomRight: [10, 10] });
  marker.on('popupclose remove', clear);
  return marker;
}
