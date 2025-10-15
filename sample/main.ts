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
        regionIds: ['1501', '1504'],
        primaryColor: '#4A639A',
        secondaryColor: '#BC514A',
      },
      // Buochs
      {
        title: 'Pfadi St. Martin Buochs',
        regionIds: ['1502', '1505'],
        primaryColor: '#75A660',
        secondaryColor: '#000000',
      },
      // Dallenwil
      {
        title: 'Pfadi St. Laurentius Dallenwil',
        regionIds: ['1503'],
        primaryColor: '#EAE065',
        secondaryColor: '#000000',
      },
      // Stans
      {
        title: 'Pfadi Winkelried Stans-Ennetmoos',
        regionIds: ['1509', '1506'],
        primaryColor: '#D03029',
        secondaryColor: '#000000',
      },
    ];
    map.setAttribute('regions', JSON.stringify(regionInfos));
    // map.setAttribute('selected-region-id', '1505');

    map.addEventListener('region-selected', (e: any) => {
      console.log('Now active:', e.detail.regionId);
    });
  });
};
