document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('token');
  const userId = sessionStorage.getItem('userId');

  const map = L.map('map').setView([-8.4095, 115.1889], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  const baseMaps = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri'
    }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenTopoMap'
    })
  };

  const savedBasemap = localStorage.getItem('selectedBasemap') || 'osm';
  baseMaps[savedBasemap].addTo(map);

  window.changeMap = function(type) {
    localStorage.setItem('selectedBasemap', type);
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });
    baseMaps[type].addTo(map);
  };

  document.querySelector('.basemap-icon').addEventListener('click', () => {
    document.querySelector('.basemap-dropdown').classList.toggle('hidden');
  });

  document.getElementById('search-location-btn').addEventListener('click', () => {
    const query = document.getElementById('location-input').value;
    if (!query) return;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
    .then(res => res.json())
    .then(data => {
      if (data.length === 0) return alert("Location not found.");
      const { lat, lon } = data[0];
      map.flyTo([parseFloat(lat), parseFloat(lon)], 14);
    })
    .catch(err => console.error("Search error:", err));
  });

  fetch(`/ruasjalan-user`, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => res.json())
    .then(data => {
      const count = (Array.isArray(data.ruasjalan)) ? data.ruasjalan.length : 0;
      document.getElementById('street-count').textContent = count;
    })
    .catch(err => console.error('Error fetch ruasjalan:', err));

  fetch(`/marker-user/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => res.json())
    .then(data => document.getElementById('marker-count').textContent = data.length || 0);

  fetch(`/polyline-user/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => res.json())
    .then(data => document.getElementById('polyline-count').textContent = data.length || 0);

  fetch(`/polygon-user/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => res.json())
    .then(data => document.getElementById('polygon-count').textContent = data.length || 0);
});
