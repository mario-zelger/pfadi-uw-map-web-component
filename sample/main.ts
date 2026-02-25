import '../src/pfadi-uw-map.ts';
// import '../dist/pfadi-uw-map.js';
// import '../dist/pfadi-uw-map.min.js';

window.onload = () => {
  setTimeout(() => {
    const map = document.getElementById('my-map');
    if (!map) {
      console.error('Map element not found');
      return;
    }

    const regionInfos = [
      {
        id: 'beckenried',
        title: 'Pfadi Isenringen Beckenried',
        municipalityIds: ['1501', '1504'],
      },
      {
        id: 'buochs',
        title: 'Pfadi St. Martin Buochs',
        municipalityIds: ['1502', '1505'],
      },
      {
        id: 'dallenwil',
        title: 'Pfadi St. Laurentius Dallenwil',
        municipalityIds: ['1503'],
      },
      {
        id: 'stans',
        title: 'Pfadi Winkelried Stans-Ennetmoos',
        municipalityIds: ['1509', '1506'],
      },
    ];
    map.setAttribute('regions', JSON.stringify(regionInfos));
    // setTimeout(() => map.setAttribute('selected-region-id', 'buochs'), 500);

    map.addEventListener('region-selected', (e: any) => {
      console.log('Now active:', e.detail.regionId);
    });

    // // Simulate DOM move after 3s: remove element, re-insert into a wrapper
    // setTimeout(() => {
    //   console.log('[test] simulating DOM move...');
    //   const wrapper = document.createElement('div');
    //   wrapper.style.width = '100%';
    //   wrapper.style.height = '100%';
    //   map.parentElement!.appendChild(wrapper);
    //   wrapper.appendChild(map);
    //   console.log('[test] DOM move complete — map should still work');
    // }, 3000);
  });
};
