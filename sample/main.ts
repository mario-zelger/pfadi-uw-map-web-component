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
        scoutingHome: {
          location: { latitude: 46.9646, longitude: 8.4764 },
          address: 'Pfadiheim Isenringen, 6375 Beckenried',
          linkWebsite: 'https://www.isenringen.ch/pfadihuette',
        },
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
        scoutingHome: {
          location: { latitude: 46.9689, longitude: 8.3622 },
          address: 'Pfadiheim Stans, 6370 Stans',
          linkWebsite: 'https://winkuriaed.ch/pfadiheim/',
        },
      },
    ];
    map.setAttribute('regions', JSON.stringify(regionInfos));
    // setTimeout(() => map.setAttribute('selected-region-id', 'buochs'), 500);

    map.addEventListener('region-selected', (e: any) => {
      console.log('Region selected:', e.detail.regionId);
    });

    map.addEventListener('scouting-home-selected', (e: any) => {
      console.log('Scouting home selected:', e.detail.regionId);
    });

    const displayModeSelect = document.getElementById('display-mode') as HTMLSelectElement;
    displayModeSelect.addEventListener('change', () => {
      map.setAttribute('display-mode', displayModeSelect.value);
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
