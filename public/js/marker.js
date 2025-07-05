document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('token');
  const userId = sessionStorage.getItem('userId');

  const popup = L.popup();
  function showPopupMessage(message) {
    const warningHtml = `
      <div class="marker-popup-form">
        <p><strong>${message}</strong></p>
        <button id="closeWarningBtn" style="width:100%; background-color: #6c757d; color:white; border:none; padding:8px; border-radius:4px;">OK</button>
      </div>
    `;

    popup.setLatLng(map.getCenter()).setContent(warningHtml).openOn(map);
    setTimeout(() => {
      document.getElementById('closeWarningBtn').onclick = () => popup.remove();
    }, 0);
  }

  const map = L.map('map').setView([-8.7, 115.15], 10);
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

  let markers = [];
  let drawMode = false;
  const markerLayerGroup = L.layerGroup().addTo(map);
  const markerMap = {};
  const loadMarkers = () => {
    fetch(`/marker-user/${userId}`)
    .then(res => res.json())
    .then(data => {
      markerLayerGroup.clearLayers();
      markers = data;
      renderMarkerList();
      data.forEach(m => {
        const marker = L.marker([m.latitude, m.longitude])
        .addTo(markerLayerGroup)
        .bindPopup(`
          <div class="popup-content">
            <strong>${m.name || 'Untitled Marker'}</strong>
            <div class="popup-description">${m.description || '-'}</div>
          </div>
        `);
        
        marker.on('click', () => {
          highlightListItem(m.id);
          viewMarker(m.id);
        });
        
        markerMap[m.id] = marker;
      });
    });
  };
  
  let currentPage = 1;
  const itemsPerPage = 10;
  const renderMarkerList = () => {
    const list = document.getElementById('marker-list');
    const pagination = document.getElementById('pagination-controls');
    list.innerHTML = '';
    pagination.innerHTML = '';

    const totalPages = Math.ceil(markers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedMarkers = markers.slice(startIndex, endIndex);

    paginatedMarkers.forEach(m => {
      const item = document.createElement('li');
      item.setAttribute('id', `marker-item-${m.id}`);
      item.innerHTML = `
        <div class="marker-header">
          <span class="marker-name">${m.name || 'Untitled Marker'}</span>
          <div class="marker-actions">
            <button class="view-btn" title="Lihat detail" onclick="viewMarker(${m.id})">👁️</button>
            <button class="edit-btn" title="Edit" onclick="editMarker(${m.id})">✏️</button>
            <button class="delete-btn" title="Hapus" onclick="deleteMarker(${m.id})">🗑️</button>
          </div>
        </div>
      `;
      list.appendChild(item);
    });
    
    // pagination
    const addPageBtn = (label, page, isActive = false, isDisabled = false) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      if (isActive) btn.classList.add('active');
      if (isDisabled) btn.disabled = true;
      btn.addEventListener('click', () => {
        currentPage = page;
        renderMarkerList();
      });
      pagination.appendChild(btn);
    };
    
    addPageBtn('<', currentPage - 1, false, currentPage === 1);
    const maxPageButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = startPage + maxPageButtons - 1;
    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxPageButtons + 1);
    }
    for (let i = startPage; i <= endPage; i++) {
      addPageBtn(i, i, i === currentPage);
    }
    if (endPage < totalPages) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.style.padding = '4px 8px';
      pagination.appendChild(dots);

      addPageBtn(totalPages, totalPages);
    }
    addPageBtn('>', currentPage + 1, false, currentPage === totalPages);
  };

  window.editMarker = (id) => {
    const m = markers.find(mk => mk.id === id);
    if (!m) return showPopupMessage("Marker tidak ditemukan.");

    const formHtml = `
      <div class="marker-popup-form">
        <form id="editMarkerForm">
          <label for="edit-name">Name:</label>
          <input type="text" id="edit-name" name="name" value="${m.name || ''}" />

          <label for="edit-description">Description:</label>
          <textarea id="edit-description" name="description">${m.description || ''}</textarea>

          <button type="submit">Update</button>
        </form>
      </div>
    `;
    
    const originalLatLng = markerMap[id]?.getLatLng() || L.latLng(m.latitude, m.longitude);
    const offsetLatLng = L.latLng(originalLatLng.lat + 0.0020, originalLatLng.lng);
    popup.setLatLng(offsetLatLng).setContent(formHtml).openOn(map);

    document.getElementById('editMarkerForm').onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-name').value;
      const description = document.getElementById('edit-description').value;

      fetch('/update-marker', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, description })
      })
      .then(() => {
        popup.remove();
        loadMarkers();
      })
      .catch(err => {
        console.error("Update failed:", err);
        showPopupMessage("Gagal mengupdate marker.");
      });
    };
  };
  
  window.deleteMarker = (id) => {
    const m = markers.find(mk => mk.id === id);
    if (!m) return showPopupMessage("Marker tidak ditemukan.");

    const latlng = markerMap[id]?.getLatLng() || [m.latitude, m.longitude];

    const confirmHtml = `
      <div class="marker-popup-form">
        <p><strong>Are you sure you want to delete this marker?</strong></p>
        <p style="margin-bottom: 24px; text-align: center;">${m.name || 'Untitled Marker'}</p>
        <div style="display: flex; gap: 10px;">
          <button id="confirmDeleteBtn" style="flex:1; background-color: rgb(202, 180, 136);">Delete</button>
          <button id="cancelDeleteBtn" style="flex:1; background-color: #6c757d;">Cancel</button>
        </div>
      </div>`;
    
    popup.setLatLng(latlng).setContent(confirmHtml).openOn(map);

    setTimeout(() => {
      document.getElementById('confirmDeleteBtn').onclick = () => {
        fetch(`/delete-marker/${id}`, { method: 'DELETE' })
        .then(() => {
          popup.remove();
          loadMarkers();
        });
      };
      
      document.getElementById('cancelDeleteBtn').onclick = () => {
        popup.remove();
      };
    }, 0);
  };

  window.viewMarker = (id) => {
    highlightListItem(id);
    const marker = markerMap[id];
    if (marker) {
      const targetLatLng = marker.getLatLng();

      // zoom out
      map.flyTo(targetLatLng, 12, { duration: 0.8 });

      // zoom in
      setTimeout(() => {
        map.flyTo(targetLatLng, 15, { duration: 1.2 });
        marker.openPopup();
      }, 600);
    }
  };

  window.toggleDescription = (id) => {
    const descDiv = document.getElementById(`desc-${id}`);
    if (!descDiv) return;
    descDiv.style.display = descDiv.style.display === 'none' ? 'block' : 'none';
  };

  map.on('click', e => {
    if (!drawMode) return;
    const latitude = e.latlng.lat;
    const longitude = e.latlng.lng;
    const formHtml = `
      <div class="marker-popup-form">
        <form id="markerForm">
          <label for="name">Name:</label>
          <input type="text" id="name" name="name" placeholder="Enter marker name" />

          <label for="description">Description:</label>
          <textarea id="description" name="description" placeholder="Enter description"></textarea>

          <button type="submit">Save</button>
        </form>
      </div>
    `;
    popup.setLatLng(e.latlng).setContent(formHtml).openOn(map);

    document.getElementById('markerForm').onsubmit = (event) => {
      event.preventDefault();
      const name = document.getElementById('name').value;
      const description = document.getElementById('description').value;

      let cleanUserId = (!userId || userId === "undefined") ? null : userId;

      fetch('/tambah-marker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude, name, description, user_id: cleanUserId })
      })
      .then(res => res.json())
      .then(data => {
        loadMarkers();
        popup.remove();
        drawMode = false;
        document.getElementById('marker-draw-control').classList.add('hidden');
      })
      .catch(err => {
        console.error('Terjadi kesalahan:', err);
        showPopupMessage('Terjadi kesalahan saat menyimpan marker');
      });
    };
  });

  document.getElementById('toggle-draw-marker').addEventListener('click', () => {
    drawMode = true;
    document.getElementById('marker-draw-control').classList.remove('hidden');
  });

  document.getElementById('cancel-marker').addEventListener('click', () => {
    drawMode = false;
    popup.remove();
    document.getElementById('marker-draw-control').classList.add('hidden');
  });

  document.getElementById('layer-toggle').addEventListener('change', (e) => {
    if (e.target.checked) {
      markerLayerGroup.addTo(map);
    } else {
      map.removeLayer(markerLayerGroup);
    }
  });

  function highlightListItem(id) {
    const index = markers.findIndex(m => m.id === id);
    if (index === -1) return;

    const targetPage = Math.floor(index / itemsPerPage) + 1;
    if (currentPage !== targetPage) {
      currentPage = targetPage;
      renderMarkerList();

      setTimeout(() => {
        const targetItem = document.querySelector(`#marker-item-${id}`);
        if (targetItem) {
          document.querySelectorAll('#marker-list li').forEach(li => li.classList.remove('highlight'));
          targetItem.classList.add('highlight');
          targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else {
      const listItems = document.querySelectorAll('#marker-list li');
      listItems.forEach(li => li.classList.remove('highlight'));

      const targetItem = document.querySelector(`#marker-item-${id}`);
      if (targetItem) {
        targetItem.classList.add('highlight');
        targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
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
    const rows = [
      ['Name', 'Description', 'Latitude', 'Longitude'],
      ...markers.map(m => [m.name, m.description, m.latitude, m.longitude])
    ];

    if (format === 'csv') {
      const csvContent = rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
      downloadFile(csvContent, 'markers.csv', 'text/csv');
    }
    if (format === 'excel') {
      const excelContent = rows.map(e => e.join("\t")).join("\n");
      downloadFile(excelContent, 'markers.xls', 'application/vnd.ms-excel');
    }
    if (format === 'json') {
    const jsonContent = JSON.stringify(markers, null, 2);
    downloadFile(jsonContent, 'markers.json', 'application/json');
    }
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById('search-location-btn').addEventListener('click', () => {
    const query = document.getElementById('location-input').value;
    if (!query) return showPopupMessage("Please enter a location.");

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
    .then(res => res.json())
    .then(data => {
      if (data.length === 0) {
        showPopupMessage("Location not found.");
        return;
      }

      const result = data[0];
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      map.flyTo([lat, lon], 13, { duration: 1.5 });
      console.log("Location Info:", result.display_name);
    })
    .catch(err => {
      console.error("Geocoding error:", err);
      showPopupMessage("Failed to fetch location.");
    });
  });

  loadMarkers();
});
