document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('token');
  const userId = sessionStorage.getItem('userId');
  const popup = L.popup();

  function showPopupMessage(message) {
    const warningHtml = `
      <div class="polygon-popup-form">
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
  
  let polygons = [];
  let drawMode = false;
  let currentPolygon = [];
  let previewPolygon = null;
  let polygonLayerGroup = L.layerGroup().addTo(map);
  const polygonMap = {};

  const loadPolygons = () => {
    fetch(`/polygon-user/${userId}`)
    .then(res => res.json())
    .then(data => {
      polygonLayerGroup.clearLayers();
      polygons = data;
      renderPolygonList();
      data.forEach(p => {
        let coords;
        try {
          coords = JSON.parse(p.coordinates);
        } catch (e) {
          return;
        }
        const poly = L.polygon(coords, { color: 'green', fillOpacity: 0.4 }).addTo(polygonLayerGroup)
        .bindPopup(`
          <div class="popup-content">
            <strong>${p.name || 'Untitled Polygon'}</strong>
            <div class="popup-description">${p.description || '-'}</div>
          </div>
        `);
        poly.on('click', () => {
          highlightListItem(p.id);
          viewPolygon(p.id);
        });
        polygonMap[p.id] = poly;
      });
    });
  };

  let currentPage = 1;
  const itemsPerPage = 10;
  const renderPolygonList = () => {
    const list = document.getElementById('polygon-list');
    const pagination = document.getElementById('pagination-controls');
    list.innerHTML = '';
    pagination.innerHTML = '';

    const totalPages = Math.ceil(polygons.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = polygons.slice(startIndex, endIndex);
    paginated.forEach(p => {
      const item = document.createElement('li');
      item.id = `polygon-item-${p.id}`;
      item.innerHTML = `
        <div class="polygon-header">
          <span class="polygon-name">${p.name || 'Untitled Polygon'}</span>
          <div class="polygon-actions">
            <button class="view-btn" title="Lihat detail" onclick="viewPolygon(${p.id})">👁️</button>
            <button class="edit-btn" title="Edit" onclick="editPolygon(${p.id})">✏️</button>
            <button class="delete-btn" title="Hapus" onclick="deletePolygon(${p.id})">🗑️</button>
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
        renderPolygonList();
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

  window.editPolygon = (id) => {
    const p = polygons.find(pl => pl.id === id);
    if (!p) return;

    const formHtml = `
      <div class="polygon-popup-form">
        <form id="editPolygonForm">
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

    document.getElementById('editPolygonForm').onsubmit = (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-name').value;
      const description = document.getElementById('edit-description').value;
      fetch('/update-polygon', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, description })
      }).then(() => {
        popup.remove();
        loadPolygons();
      });
    };
  };

  window.deletePolygon = (id) => {
    const p = polygons.find(pl => pl.id === id);
    if (!p) return;

    const latlng = JSON.parse(p.coordinates)[0];
    const confirmHtml = `
      <div class="polygon-popup-form">
        <p><strong>Are you sure you want to delete this marker?</strong></p>
        <p style="margin-bottom: 24px; text-align: center;">${p.name || 'Untitled Polygon'}</p>
        <div style="display: flex; gap: 10px;">
          <button id="confirmDeleteBtn" style="flex:1; background-color: rgb(202, 180, 136);">Delete</button>
          <button id="cancelDeleteBtn" style="flex:1; background-color: #6c757d;">Cancel</button>
        </div>
      </div>`;

    popup.setLatLng(latlng).setContent(confirmHtml).openOn(map);

    setTimeout(() => {
      document.getElementById('confirmDeleteBtn').onclick = () => {
        fetch(`/delete-polygon/${id}`, { method: 'DELETE' }).then(() => {
          popup.remove();
          loadPolygons();
        });
      };
      document.getElementById('cancelDeleteBtn').onclick = () => popup.remove();
    }, 0);
  };

  window.viewPolygon = (id) => {
    const poly = polygonMap[id];
    if (poly) {
      map.flyToBounds(poly.getBounds(), {
        padding: [30, 30],
        duration: 1.2
      });
      poly.openPopup();
      highlightListItem(id);
    }
  };

  let startMarker = null;
  let snapRadius = 15;
  map.on('click', e => {
    if (!drawMode) return;
    const latlng = e.latlng;
    let point = [latlng.lat, latlng.lng];

    if (currentPolygon.length === 0) {
      startMarker = L.circleMarker(point, {
        radius: 6,
        color: 'green',
        fillColor: 'white',
        fillOpacity: 1,
        weight: 2
      }).addTo(map);
    }
    if (currentPolygon.length > 0) {
      const first = currentPolygon[0];
      const dist = map.distance(L.latLng(first[0], first[1]), latlng);
      if (dist < 10) {
        point = first;
      }
    }
    currentPolygon.push(point);
    if (previewPolygon) map.removeLayer(previewPolygon);
    previewPolygon = L.polyline([...currentPolygon], {
      color: 'green',
      dashArray: '5,5'
    }).addTo(map);
    if (tempEdge) {
      map.removeLayer(tempEdge);
      tempEdge = null;
    }
  });

  let tempEdge = null;
  map.on('mousemove', e => {
    if (!drawMode || currentPolygon.length === 0) return;

    const last = currentPolygon[currentPolygon.length - 1];
    let nextPoint = [e.latlng.lat, e.latlng.lng];

    const first = currentPolygon[0];
    const pixelFirst = map.latLngToContainerPoint(L.latLng(first));
    const pixelCursor = map.latLngToContainerPoint(e.latlng);
    const dist = pixelFirst.distanceTo(pixelCursor);

    if (dist < snapRadius) {
      nextPoint = first;
      if (startMarker) startMarker.setStyle({ fillColor: 'lime' });
    } else {
      if (startMarker) startMarker.setStyle({ fillColor: 'white' });
    }
    const latlngs = [last, nextPoint];
    if (tempEdge) {
      tempEdge.setLatLngs(latlngs);
    } else {
      tempEdge = L.polyline(latlngs, { color: 'gray', dashArray: '2,6' }).addTo(map);
    }
  });

  document.getElementById('toggle-draw-polygon').addEventListener('click', () => {
    drawMode = true;
    currentPolygon = [];
    document.getElementById('polygon-draw-control').classList.remove('hidden');
  });

  document.getElementById('cancel-polygon').addEventListener('click', () => {
    drawMode = false;
    currentPolygon = [];
    if (previewPolygon) map.removeLayer(previewPolygon);
    if (tempEdge) {
      map.removeLayer(tempEdge);
      tempEdge = null;
    }
    if (startMarker) {
      map.removeLayer(startMarker);
      startMarker = null;
    }
    document.getElementById('polygon-draw-control').classList.add('hidden');
  });

  document.getElementById('finish-polygon').addEventListener('click', () => {
    if (currentPolygon.length < 3) {
      showPopupMessage('Minimal 3 titik untuk polygon.');
      return;
    }

    const first = currentPolygon[0];
    const last = currentPolygon[currentPolygon.length - 1];
    const pixelFirst = map.latLngToContainerPoint(L.latLng(first));
    const pixelLast = map.latLngToContainerPoint(L.latLng(last));
    const dist = pixelFirst.distanceTo(pixelLast);
    if (dist > snapRadius) {
      const warningHtml = `
        <div class="polygon-popup-form">
          <p><strong>Polygon belum ditutup!</strong></p>
          <p style="margin-bottom: 12px;">Silakan klik kembali ke titik awal untuk menutup polygon sebelum menyimpan.</p>
          <button id="closeWarning" style="width:100%; background-color: #6c757d; color:white; border:none; padding:8px; border-radius:4px;">OK</button>
        </div>
      `;
      const center = currentPolygon[Math.floor(currentPolygon.length / 2)];
      popup.setLatLng(center).setContent(warningHtml).openOn(map);

      setTimeout(() => {
        document.getElementById('closeWarning').onclick = () => popup.remove();
      }, 0);

      return;
    }

    const formHtml = `
      <div class="polygon-popup-form">
        <form id="savePolygonForm">
          <label for="name">Name:</label>
          <input type="text" id="name" />
          <label for="description">Description:</label>
          <textarea id="description"></textarea>
          <button type="submit">Save</button>
        </form>
      </div>`;
    const center = currentPolygon[Math.floor(currentPolygon.length / 2)];
    popup.setLatLng(center).setContent(formHtml).openOn(map);

    document.getElementById('savePolygonForm').onsubmit = (e) => {
      e.preventDefault();
      currentPolygon[currentPolygon.length - 1] = currentPolygon[0];

      const name = document.getElementById('name').value;
      const description = document.getElementById('description').value;
      const cleanUserId = (!userId || userId === "undefined") ? null : userId;
      fetch('/tambah-polygon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinates: currentPolygon,
          name,
          description,
          user_id: cleanUserId
        })
      }).then(() => {
        drawMode = false;
        currentPolygon = [];
        if (previewPolygon) map.removeLayer(previewPolygon);
        if (tempEdge) map.removeLayer(tempEdge);
        if (startMarker) map.removeLayer(startMarker);
        popup.remove();
        document.getElementById('polygon-draw-control').classList.add('hidden');
        loadPolygons();
      });
    };
  });

  document.getElementById('undo-polygon').addEventListener('click', () => {
    if (currentPolygon.length > 0) {
      currentPolygon.pop();
      if (previewPolygon) map.removeLayer(previewPolygon);
      if (currentPolygon.length > 0) {
        previewPolygon = L.polygon(currentPolygon, {
          color: 'green',
          fillOpacity: 0.3,
          dashArray: '5,5'
        }).addTo(map);
      }
    }
  });

  document.getElementById('layer-toggle').addEventListener('change', (e) => {
    if (e.target.checked) polygonLayerGroup.addTo(map);
    else map.removeLayer(polygonLayerGroup);
  });

  function highlightListItem(id) {
    const index = polygons.findIndex(p => p.id === id);
    if (index === -1) return;

    const targetPage = Math.floor(index / itemsPerPage) + 1;
    if (currentPage !== targetPage) {
      currentPage = targetPage;
      renderPolygonList();

      setTimeout(() => {
        const targetItem = document.querySelector(`#polygon-item-${id}`);
        if (targetItem) {
          document.querySelectorAll('#polygon-list li').forEach(li => li.classList.remove('highlight'));
          targetItem.classList.add('highlight');
          targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else {
      const targetItem = document.querySelector(`#polygon-item-${id}`);
      if (targetItem) {
        document.querySelectorAll('#polygon-list li').forEach(li => li.classList.remove('highlight'));
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
      ...polygons.map(p => [p.name, p.description, p.coordinates])
    ];
    if (format === 'csv') {
      const csvContent = rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
      downloadFile(csvContent, 'polygons.csv', 'text/csv');
    }
    if (format === 'excel') {
      const excelContent = rows.map(e => e.join("\t")).join("\n");
      downloadFile(excelContent, 'polygons.xls', 'application/vnd.ms-excel');
    }
    if (format === 'json') {
      const jsonContent = JSON.stringify(polygons, null, 2);
      downloadFile(jsonContent, 'polygons.json', 'application/json');
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
    })
    .catch(err => {
      console.error("Geocoding error:", err);
      showPopupMessage("Failed to fetch location.");
    });
  });

  loadPolygons();
});