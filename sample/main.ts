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
        // Beckenried
        title: 'Pfadi Isenringen Beckenried',
        municipalityIds: ['1501', '1504'],
      },
      // Buochs
      {
        title: 'Pfadi St. Martin Buochs',
        municipalityIds: ['1502', '1505'],
      },
      // Dallenwil
      {
        title: 'Pfadi St. Laurentius Dallenwil',
        municipalityIds: ['1503'],
      },
      // Stans
      {
        title: 'Pfadi Winkelried Stans-Ennetmoos',
        municipalityIds: ['1509', '1506'],
      },
    ];
    map.setAttribute('regions', JSON.stringify(regionInfos));
    // setTimeout(() => map.setAttribute('selected-municipality-id', '1505'), 500);

    map.addEventListener('region-selected', (e: any) => {
      console.log('Now active:', e.detail.municipalityId);
    });
  });
};
