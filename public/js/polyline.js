document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('token');
  const userId = sessionStorage.getItem('userId');
  const popup = L.popup();

  function showPopupMessage(message) {
    const warningHtml = `
      <div class="polyline-popup-form">
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
  
  let polylines = [];
  let drawMode = false;
  let currentLine = [];
  let previewLine = null;
  let polylineLayerGroup = L.layerGroup().addTo(map);
  const polylineMap = {};

  const loadPolylines = () => {
    fetch(`/polyline-user/${userId}`)
    .then(res => res.json())
    .then(data => {
      polylineLayerGroup.clearLayers();
      polylines = data;
      renderPolylineList();
      data.forEach(p => {
        let coords;
        try {
          coords = JSON.parse(p.coordinates);
        } catch (e) {
          return;
        }
        const pl = L.polyline(coords, { color: 'blue' }).addTo(polylineLayerGroup)
        .bindPopup(`
          <div class="popup-content">
            <strong>${p.name || 'Untitled Polyline'}</strong>
            <div class="popup-description">${p.description || '-'}</div>
          </div>
        `);
        pl.on('click', () => {
          highlightListItem(p.id);
          viewPolyline(p.id);
        });
        polylineMap[p.id] = pl;
      });
    });
  };

  let currentPage = 1;
  const itemsPerPage = 10;

  const renderPolylineList = () => {
    const list = document.getElementById('polyline-list');
    const pagination = document.getElementById('pagination-controls');
    list.innerHTML = '';
    pagination.innerHTML = '';

    const totalPages = Math.ceil(polylines.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = polylines.slice(startIndex, endIndex);

    paginated.forEach(p => {
      const item = document.createElement('li');
      item.id = `polyline-item-${p.id}`;
      item.innerHTML = `
        <div class="polyline-header">
          <span class="polyline-name">${p.name || 'Untitled Polyline'}</span>
          <div class="polyline-actions">
            <button class="view-btn" title="Lihat detail" onclick="viewPolyline(${p.id})">👁️</button>
            <button class="edit-btn" title="Edit" onclick="editPolyline(${p.id})">✏️</button>
            <button class="delete-btn" title="Hapus" onclick="deletePolyline(${p.id})">🗑️</button>
          </div>
        </div>`;
      list.appendChild(item);
    });

    const addPageBtn = (label, page, isActive = false, isDisabled = false) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      if (isActive) btn.classList.add('active');
      if (isDisabled) btn.disabled = true;
      btn.onclick = () => {
        currentPage = page;
        renderPolylineList();
      };
      pagination.appendChild(btn);
    };
    addPageBtn('<', currentPage - 1, false, currentPage === 1);

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    for (let i = startPage; i <= endPage; i++) {
      addPageBtn(i, i, i === currentPage);
    }
    addPageBtn('>', currentPage + 1, false, currentPage === totalPages);
  };

  window.editPolyline = (id) => {
    const p = polylines.find(pl => pl.id === id);
    if (!p) return;
    const formHtml = `
      <div class="polyline-popup-form">
        <form id="editPolylineForm">
          <label for="edit-name">Name:</label>
          <input type="text" id="edit-name" value="${p.name || ''}" />

          <label for="edit-description">Description:</label>
          <textarea id="edit-description">${p.description || ''}</textarea>

          <button type="submit">Update</button>
        </form>
      </div>`;

    const coords = JSON.parse(p.coordinates);
    const latlng = coords[Math.floor(coords.length / 2)];
    popup.setLatLng(latlng).setContent(formHtml).openOn(map);

    document.getElementById('editPolylineForm').onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-name').value;
      const description = document.getElementById('edit-description').value;
      fetch('/update-polyline', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, description })
      }).then(() => {
        popup.remove();
        loadPolylines();
      });
    };
  };

  window.deletePolyline = (id) => {
    const p = polylines.find(pl => pl.id === id);
    if (!p) return;
    const latlng = JSON.parse(p.coordinates)[0];
    const confirmHtml = `
      <div class="polyline-popup-form">
        <p><strong>Are you sure you want to delete this marker?</strong></p>
        <p style="margin-bottom: 24px; text-align: center;">${p.name || 'Untitled Polyline'}</p>
        <div style="display: flex; gap: 10px;">
          <button id="confirmDeleteBtn" style="flex:1; background-color: rgb(202, 180, 136);">Delete</button>
          <button id="cancelDeleteBtn" style="flex:1; background-color: #6c757d;">Cancel</button>
        </div>
      </div>`;
    popup.setLatLng(latlng).setContent(confirmHtml).openOn(map);

    setTimeout(() => {
      document.getElementById('confirmDeleteBtn').onclick = () => {
        fetch(`/delete-polyline/${id}`, { method: 'DELETE' }).then(() => {
          popup.remove();
          loadPolylines();
        });
      };
      document.getElementById('cancelDeleteBtn').onclick = () => popup.remove();
    }, 0);
  };

  window.viewPolyline = (id) => {
    const line = polylineMap[id];
    if (line) {
      map.flyToBounds(line.getBounds(), {
        padding: [30, 30],
        duration: 1.2
      });
      line.openPopup();
      highlightListItem(id);
    }
  };

  map.on('click', e => {
    if (!drawMode) return;
    currentLine.push([e.latlng.lat, e.latlng.lng]);
    if (previewLine) map.removeLayer(previewLine);
    previewLine = L.polyline(currentLine, { color: 'blue', dashArray: '5,5' }).addTo(map);
    if (currentLine.length >= 2 && tempLine) {
      map.removeLayer(tempLine);
      tempLine = null;
    }
  });

  let tempLine = null;
  map.on('mousemove', e => {
    if (!drawMode || currentLine.length === 0) return;

    const latlngs = [currentLine[currentLine.length - 1], [e.latlng.lat, e.latlng.lng]];
    if (tempLine) {
      tempLine.setLatLngs(latlngs);
    } else {
      tempLine = L.polyline(latlngs, { color: 'gray', dashArray: '2,6' }).addTo(map);
    }
  });

  document.getElementById('toggle-draw-polyline').addEventListener('click', () => {
    drawMode = true;
    currentLine = [];
    document.getElementById('polyline-draw-control').classList.remove('hidden');
  });

  document.getElementById('cancel-polyline').addEventListener('click', () => {
    drawMode = false;
    currentLine = [];
    if (previewLine) map.removeLayer(previewLine);
    if (tempLine) {
      map.removeLayer(tempLine);
      tempLine = null;
    }
    document.getElementById('polyline-draw-control').classList.add('hidden');
  });

  document.getElementById('finish-polyline').addEventListener('click', () => {
    if (currentLine.length < 2) {
      showPopupMessage('Minimal 2 titik untuk polyline.');
      return;
    }
    const formHtml = `
      <div class="polyline-popup-form">
        <form id="savePolylineForm">
          <label for="name">Name:</label>
          <input type="text" id="name" />
          <label for="description">Description:</label>
          <textarea id="description"></textarea>
          <button type="submit">Save</button>
        </form>
      </div>`;
    const center = currentLine[Math.floor(currentLine.length / 2)];
    popup.setLatLng(center).setContent(formHtml).openOn(map);

    document.getElementById('savePolylineForm').onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value;
      const description = document.getElementById('description').value;
      const cleanUserId = (!userId || userId === "undefined") ? null : userId;

      fetch('/tambah-polyline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinates: currentLine,
          name,
          description,
          user_id: cleanUserId
        })
      })
      .then(() => {
        drawMode = false;
        currentLine = [];
        if (previewLine) map.removeLayer(previewLine);
        if (tempLine) {
          map.removeLayer(tempLine);
          tempLine = null;
        }
        popup.remove();
        document.getElementById('polyline-draw-control').classList.add('hidden');
        loadPolylines();
      });
    };
  });

  document.getElementById('undo-polyline').addEventListener('click', () => {
    if (currentLine.length > 0) {
      currentLine.pop();
      if (previewLine) map.removeLayer(previewLine);
      if (currentLine.length > 0) {
        previewLine = L.polyline(currentLine, {
          color: 'blue',
          dashArray: '5,5'
        }).addTo(map);
      }
    } else {
      showPopupMessage('Tidak ada titik yang bisa dihapus.');
    }
  });

  document.getElementById('layer-toggle').addEventListener('change', (e) => {
    if (e.target.checked) polylineLayerGroup.addTo(map);
    else map.removeLayer(polylineLayerGroup);
  });

  function highlightListItem(id) {
    const index = polylines.findIndex(m => m.id === id);
    if (index === -1) return;

    const targetPage = Math.floor(index / itemsPerPage) + 1;
    if (currentPage !== targetPage) {
      currentPage = targetPage;
      renderPolylineList();

      setTimeout(() => {
        const targetItem = document.querySelector(`#polyline-item-${id}`);
        if (targetItem) {
          document.querySelectorAll('#polyline-list li').forEach(li => li.classList.remove('highlight'));
          targetItem.classList.add('highlight');
          targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else {
      const listItems = document.querySelectorAll('#polyline-list li');
      listItems.forEach(li => li.classList.remove('highlight'));

      const targetItem = document.querySelector(`#polyline-item-${id}`);
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
      ['Name', 'Description', 'Coordinates'],
      ...polylines.map(p => [p.name, p.description, p.coordinates])
    ];
    if (format === 'csv') {
      const csvContent = rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
      downloadFile(csvContent, 'polylines.csv', 'text/csv');
    }
    if (format === 'excel') {
      const excelContent = rows.map(e => e.join("\t")).join("\n");
      downloadFile(excelContent, 'polylines.xls', 'application/vnd.ms-excel');
    }
    if (format === 'json') {
      const jsonContent = JSON.stringify(polylines, null, 2);
      downloadFile(jsonContent, 'polylines.json', 'application/json');
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

  loadPolylines();
});
