document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('token');
  const popup = L.popup();
  function showPopupMessage(message) {
    const warningHtml = `
      <div class="street-popup-form">
        <p><strong>${message}</strong></p>
        <button id="closeWarningBtn" style="width:100%; background-color: #6c757d; color:white; border:none; padding:8px; border-radius:4px;">OK</button>
      </div>
    `;
    popup.setLatLng(map.getCenter()).setContent(warningHtml).openOn(map);

    setTimeout(() => {
      document.getElementById('closeWarningBtn').onclick = () => popup.remove();
    }, 0);
  }
  
  const map = L.map('map').setView([-8.409518, 115.188919], 13);

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

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  const layerGroup = L.layerGroup().addTo(map);
  const listElement = document.getElementById('street-list');
  const paginationElement = document.getElementById('pagination-controls');

  let currentPage = 1;
  const itemsPerPage = 10;
  let streets = [];
  const streetMap = {};

  function getStyle(jenisId, kondisiId, eksistingId) {
    const colorMap = { 1: 'red', 2: 'orange', 3: 'blue' };
    const weightMap = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10 };
    const baseWeight = weightMap[eksistingId] || 3;
    const dashArrayMap = {
      1: null,
      2: `${baseWeight * 2}, ${baseWeight * 2}`,
      3: `${baseWeight}, ${baseWeight * 3}`
    };
    return {
      color: colorMap[jenisId] || 'gray',
      weight: baseWeight,
      dashArray: dashArrayMap[kondisiId] || null
    };
  }

  function parsePaths(rawPaths) {
    try {
      const fixed = rawPaths.trim();
      if (fixed.startsWith('[[')) return JSON.parse(fixed);
      return JSON.parse(`[${fixed}]`);
    } catch (e) {
      return [];
    }
  }

  function renderStreets() {
    layerGroup.clearLayers();
    streets.forEach(street => {
      const coords = parsePaths(street.paths);
      if (!coords.length) return;

      const style = getStyle(street.jenisjalan_id, street.kondisi_id, street.eksisting_id);
      const poly = L.polyline(coords, style).addTo(layerGroup);
      poly.bindPopup(`
        <div class="popup-content">
          <strong>${street.nama_ruas}</strong><br>
          <div style="margin-top: 6px;">
            Panjang: ${street.panjang} m<br>
            Lebar: ${street.lebar} m<br>
            <div class="popup-description">${street.keterangan || '-'}</div>
          </div>
        </div>
      `);

      poly.on('click', () => {
        highlightListItem(street.id);
        flyToStreet(street.id);
        poly.openPopup();
      });

      poly._id = street.id;
      streetMap[street.id] = poly;
    });
  }

  function renderStreetList() {
    listElement.innerHTML = '';
    paginationElement.innerHTML = '';

    const totalPages = Math.ceil(streets.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const paginated = streets.slice(start, end);

    paginated.forEach(street => {
      const li = document.createElement('li');
      li.id = `street-item-${street.id}`;
      li.innerHTML = `
        <div class="street-header">
          <span class="street-name">${street.nama_ruas || '-'}</span>
          <div class="street-actions">
            <button class="view-btn" title="Lihat detail" onclick="flyToStreet(${street.id})">👁️</button>
            <button class="edit-btn" title="Edit" onclick="editStreetPopup(${street.id})">✏️</button>
            <button class="delete-btn" title="Hapus" onclick="deleteStreet(${street.id})">🗑️</button>
          </div>
        </div>`;
       listElement.appendChild(li);
    });

    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      if (i === currentPage) btn.classList.add('active');
      btn.onclick = () => {
        currentPage = i;
        renderStreetList();
      };
      paginationElement.appendChild(btn);
    }
  }

  function highlightListItem(id) {
    const index = streets.findIndex(s => s.id === id);
    if (index === -1) return;

    const targetPage = Math.floor(index / itemsPerPage) + 1;
    if (currentPage !== targetPage) {
      currentPage = targetPage;
      renderStreetList();
      setTimeout(() => highlightItemNow(id), 100);
    } else {
      highlightItemNow(id);
    }
  }

  function highlightItemNow(id) {
    document.querySelectorAll('#street-list li').forEach(li => li.classList.remove('highlight'));
    const targetItem = document.querySelector(`#street-item-${id}`);
    if (targetItem) {
      targetItem.classList.add('highlight');
      targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  window.flyToStreet = function (id) {
    const street = streets.find(s => s.id === id);
    const poly = streetMap[id];
    if (!street || !poly) return;

    const bounds = poly.getBounds();
    map.flyTo(bounds.getCenter(), 10, { duration: 0.6 });

    setTimeout(() => {
      map.flyToBounds(bounds, {
        padding: [20, 20],
        duration: 1.2
      });
      poly.openPopup();
      highlightListItem(id);
    }, 800);
  };

  window.deleteStreet = function(id) {
    const street = streets.find(s => s.id === id);
    if (!street) return;

    const confirmHtml = `
      <div class="street-popup-form">
        <p><strong>Are you sure you want to delete this street?</strong></p>
        <p style="margin-bottom: 24px; text-align: center;">${street.nama_ruas || '-'}</p>
        <div style="display: flex; gap: 10px;">
          <button id="confirmDeleteBtn" style="flex:1; background-color: rgb(202, 180, 136);">Delete</button>
          <button id="cancelDeleteBtn" style="flex:1; background-color: #6c757d;">Cancel</button>
        </div>
      </div>`;

    const latlng = streetMap[id]?.getBounds()?.getCenter() || map.getCenter();
    popup.setLatLng(latlng).setContent(confirmHtml).openOn(map);

    setTimeout(() => {
      document.getElementById('confirmDeleteBtn').onclick = () => {
        fetch(`https://gisapis.manpits.xyz/api/ruasjalan/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(json => {
          if (json.status === 'success') {
            showPopupMessage('Ruas jalan berhasil dihapus.');
            loadData();
          } else {
            showPopupMessage('Gagal menghapus ruas jalan.');
          }
        })
        .catch(err => {
          console.error('Error saat menghapus ruas jalan:', err);
          showPopupMessage('Terjadi kesalahan saat menghapus.');
        });
      };
      document.getElementById('cancelDeleteBtn').onclick = () => popup.remove();
    }, 0);
  };

  window.editStreetPopup = function(id) {
    const street = streets.find(s => s.id === id);
    if (!street) return;

    const formHtml = `
      <div class="street-popup-form">
        <form id="editStreetForm">
          <label for="edit-nama-ruas">Nama Ruas:</label>
          <input type="text" id="edit-nama-ruas" value="${street.nama_ruas || ''}" />

          <label for="edit-lebar">Lebar (meter):</label>
          <input type="number" id="edit-lebar" value="${street.lebar || ''}" />

          <label for="edit-keterangan">Keterangan:</label>
          <textarea id="edit-keterangan">${street.keterangan || ''}</textarea>

          <button type="submit">Update</button>
        </form>
      </div>
    `;

    const center = streetMap[id]?.getBounds()?.getCenter() || map.getCenter();
    popup.setLatLng(center).setContent(formHtml).openOn(map);
    setTimeout(() => {
      document.getElementById('editStreetForm').onsubmit = function(e) {
        e.preventDefault();

        const updatedStreet = {
          nama_ruas: document.getElementById('edit-nama-ruas').value,
          lebar: parseFloat(document.getElementById('edit-lebar').value),
          panjang: parseFloat(document.getElementById('edit-panjang').value),
          keterangan: document.getElementById('edit-keterangan').value,
        };

        fetch(`https://gisapis.manpits.xyz/api/ruasjalan/${id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatedStreet)
        })
        .then(res => res.json())
        .then(resJson => {
          if (resJson.status === 'success') {
            popup.remove();
            showPopupMessage('Ruas jalan berhasil diperbarui.');
            loadData();
          } else {
            showPopupMessage('Gagal memperbarui ruas jalan.');
          }
        })
        .catch(err => {
          console.error('Error update ruas jalan:', err);
          showPopupMessage('Terjadi kesalahan saat update.');
        });
      };
    }, 0);
  };

  function loadData() {
    fetch('https://gisapis.manpits.xyz/api/ruasjalan', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(json => {
        streets = json.ruasjalan || [];
        renderStreets();
        renderStreetList();
      })
      .catch(err => {
        console.error('Gagal mengambil data ruas jalan:', err);
      });
  }

  document.getElementById('export-button').addEventListener('click', () => {
    document.getElementById('export-options').classList.toggle('hidden');
  });

  document.querySelectorAll('#export-options button').forEach(btn => {
    btn.addEventListener('click', () => {
      const format = btn.getAttribute('data-format');
      exportData(format);
      document.getElementById('export-options').classList.add('hidden');
    });
  });

  function exportData(format) {
    if (streets.length === 0) {
      showPopupMessage("Tidak ada data untuk diekspor.");
      return;
    }

    const headers = Object.keys(streets[0]);
    const rows = [
      headers,
      ...streets.map(street =>
        headers.map(key => {
          const value = street[key];
          return typeof value === 'object' ? JSON.stringify(value) : value;
        })
      )
    ];

    if (format === 'csv') {
      const csv = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
      downloadFile(csv, 'street.csv', 'text/csv');
    }
    if (format === 'excel') {
      const excel = rows.map(r => r.join('\t')).join('\n');
      downloadFile(excel, 'street.xls', 'application/vnd.ms-excel');
    }
    if (format === 'json') {
      const json = JSON.stringify(streets, null, 2);
      downloadFile(json, 'street.json', 'application/json');
    }
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById('search-location-btn').addEventListener('click', () => {
    const query = document.getElementById('location-input').value;
    if (!query) return;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
      .then(res => res.json())
      .then(data => {
        if (data.length === 0) return showPopupMessage('Lokasi tidak ditemukan.');
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        map.flyTo([lat, lon], 14, { duration: 1.5 });
      })
      .catch(err => {
        console.error("Geocoding error:", err);
      });
  });

  document.getElementById('toggle-draw-street').addEventListener('click', () => {
    location.href = 'add-street.html';
  });

  document.getElementById('layer-toggle').addEventListener('change', e => {
    if (e.target.checked) {
      layerGroup.addTo(map);
    } else {
      map.removeLayer(layerGroup);
    }
  });

  loadData();
});