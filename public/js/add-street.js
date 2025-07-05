document.addEventListener('DOMContentLoaded', () => {
  const endpoints = {
    region: '/api/mregion',
    eksisting: '/api/meksisting',
    kondisi: '/api/mkondisi',
    jenisjalan: '/api/mjenisjalan'
  };

  const selects = {
    desa_id: document.getElementById('desa_id'),
    eksisting_id: document.getElementById('eksisting_id'),
    kondisi_id: document.getElementById('kondisi_id'),
    jenisjalan_id: document.getElementById('jenisjalan_id')
  };

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

  const mapKeyToLabel = {
      eksisting: 'eksisting',
      kondisi: 'kondisi',
      jenisjalan: 'jenisjalan'
  };
  ['eksisting', 'kondisi', 'jenisjalan'].forEach(key => {
      fetch(endpoints[key], { headers: { 'Authorization': `Bearer ${token}` } })
          .then(res => res.json())
          .then(data => {
              const arr = data.eksisting;
              arr.forEach(item => {
                  const o = document.createElement('option');
                  o.value = item.id;
                  o.textContent = item[mapKeyToLabel[key]];
                  selects[`${key}_id`].appendChild(o);
              });
          })
          .catch(err => {
              console.error(`Gagal ambil data ${key}:`, err);
          });
  });

  fetch(endpoints.region, { headers: { 'Authorization': `Bearer ${token}` } })
  .then(res => res.json())
  .then(data => {
    const { provinsi, kabupaten, kecamatan, desa } = data;
    const selectProv = document.getElementById('provinsi');
    const selectKab = document.getElementById('kabupaten');
    const selectKec = document.getElementById('kecamatan');
    const selectDesa = selects.desa_id;

    provinsi.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.provinsi;
      selectProv.appendChild(o);
    });

    selectProv.addEventListener('change', () => {
      selectKab.innerHTML = '<option>Pilih Kabupaten</option>';
      selectKec.innerHTML = '<option>Pilih Kecamatan</option>';
      selectDesa.innerHTML = '<option>Pilih Desa</option>';

      const selectedProvId = parseInt(selectProv.value);
      const filteredKab = kabupaten.filter(k => k.prov_id === selectedProvId);
      filteredKab.forEach(k => {
        const o = document.createElement('option');
        o.value = k.id;
        o.textContent = k.kabupaten;
        selectKab.appendChild(o);
      });
    });

    selectKab.addEventListener('change', () => {
      selectKec.innerHTML = '<option>Pilih Kecamatan</option>';
      selectDesa.innerHTML = '<option>Pilih Desa</option>';

      const selectedKabId = parseInt(selectKab.value);
      const filteredKec = kecamatan.filter(k => k.kab_id === selectedKabId);
      filteredKec.forEach(k => {
        const o = document.createElement('option');
        o.value = k.id;
        o.textContent = k.kecamatan;
        selectKec.appendChild(o);
      });
    });

    selectKec.addEventListener('change', () => {
      selectDesa.innerHTML = '<option>Pilih Desa</option>';

      const selectedKecId = parseInt(selectKec.value);
      const filteredDesa = desa.filter(d => d.kec_id === selectedKecId);
      filteredDesa.forEach(d => {
        const o = document.createElement('option');
        o.value = d.id;
        o.textContent = d.desa;
        selectDesa.appendChild(o);
      });

      selectDesa.addEventListener('change', () => {
        const prov = selectProv.options[selectProv.selectedIndex].text;
        const kab = selectKab.options[selectKab.selectedIndex].text;
        const kec = selectKec.options[selectKec.selectedIndex].text;
        const desa = selectDesa.options[selectDesa.selectedIndex].text;
        searchAndFlyToLocation(prov, kab, kec, desa);
      });
    });
  })
  .catch(err => console.error('Gagal ambil data region:', err));

  window.map = L.map('map').setView([-8.409518, 115.188919], 13);

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

  const drawnPath = [];
  let previewLine;
  function getStyle(jenisId, kondisiId, eksistingId) {
    const colorMap = {
      1: 'red',      // Jalan Desa
      2: 'orange',   // Jalan Kabupaten
      3: 'blue'      // Jalan Provinsi
    };

    const weightMap = {
      1: 2,
      2: 3,
      3: 4,
      4: 5,
      5: 6,
      6: 7,
      7: 8,
      8: 9,
      9: 10
    };

    const baseWeight = weightMap[eksistingId] || 3;

    const dashArrayMap = {
      1: null,                                     // Baik (utuh)
      2: `${baseWeight * 2}, ${baseWeight * 2}`,   // Sedang
      3: `${baseWeight}, ${baseWeight * 3}`        // Rusak
    };
    return {
      color: colorMap[jenisId] || 'gray',
      weight: baseWeight,
      dashArray: dashArrayMap[kondisiId] || null
    };
  }

  let tempLine = null;
  map.on('click', e => {
    if (!selects.eksisting_id.value || !selects.kondisi_id.value || !selects.jenisjalan_id.value) {
      showPopupMessage('Silakan pilih Eksisting, Kondisi, dan Jenis Jalan terlebih dahulu.');
      return;
    }

    drawnPath.push([e.latlng.lat, e.latlng.lng]);

    if (previewLine) map.removeLayer(previewLine);

    const eksistingId = parseInt(selects.eksisting_id.value);
    const kondisiId = parseInt(selects.kondisi_id.value);
    const jenisId = parseInt(selects.jenisjalan_id.value);

    const style = getStyle(jenisId, kondisiId, eksistingId);
    previewLine = L.polyline(drawnPath, {
      color: style.color,
      weight: style.weight,
      dashArray: style.dashArray
    }).addTo(map);
  });

  map.on('mousemove', e => {
    if (drawnPath.length === 0) return;
    const lastPoint = drawnPath[drawnPath.length - 1];
    const previewSegment = [lastPoint, [e.latlng.lat, e.latlng.lng]];
    if (tempLine) {
      tempLine.setLatLngs(previewSegment);
    } else {
      tempLine = L.polyline(previewSegment, { color: 'gray', dashArray: '2,6' }).addTo(map);
    }
  });

  function updatePreviewStyle() {
    if (!previewLine || drawnPath.length === 0) return;
    const eksistingId = parseInt(selects.eksisting_id.value);
    const kondisiId = parseInt(selects.kondisi_id.value);
    const jenisId = parseInt(selects.jenisjalan_id.value);
    const style = getStyle(jenisId, kondisiId, eksistingId);

    map.removeLayer(previewLine);
    previewLine = L.polyline(drawnPath, {
      color: style.color,
      weight: style.weight,
      dashArray: style.dashArray
    }).addTo(map);
  }

  selects.eksisting_id.addEventListener('change', updatePreviewStyle);
  selects.kondisi_id.addEventListener('change', updatePreviewStyle);
  selects.jenisjalan_id.addEventListener('change', updatePreviewStyle);

  document.getElementById('streetForm').addEventListener('submit', e => {
    e.preventDefault();
    if (drawnPath.length < 2) return showPopupMessage('Klik minimal 2 titik di peta.');

    const payload = {
        desa_id: selects.desa_id.value,
        kode_ruas: document.getElementById('kode_ruas').value,
        nama_ruas: document.getElementById('nama_ruas').value,
        eksisting_id: selects.eksisting_id.value,
        kondisi_id: selects.kondisi_id.value,
        jenisjalan_id: selects.jenisjalan_id.value,
        panjang: document.getElementById('panjang').value,
        lebar: document.getElementById('lebar').value,
        keterangan: document.getElementById('keterangan').value,
        paths: JSON.stringify(drawnPath),
        user_id: sessionStorage.getItem('userId')
    };

    fetch('/api/ruasjalan', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': token
      },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(resJson => {
        if (resJson.status === 'success') {
            showPopupMessage('Ruas jalan berhasil disimpan!');

            document.getElementById('streetForm').reset();

            document.getElementById('kode_ruas').value = '';
            document.getElementById('panjang').value = '';

            document.getElementById('kabupaten').innerHTML = '<option value="" disabled selected>Pilih Kabupaten</option>';
            document.getElementById('kecamatan').innerHTML = '<option value="" disabled selected>Pilih Kecamatan</option>';
            document.getElementById('desa_id').innerHTML = '<option value="" disabled selected>Pilih Desa</option>';

           if (previewLine) {
              map.removeLayer(previewLine);
              previewLine = null;
            }

           if (tempLine) {
              map.removeLayer(tempLine);
              tempLine = null;
            }

            drawnPath.length = 0;
            if (previewLine) map.removeLayer(previewLine);
        } else {
            showPopupMessage('Gagal menyimpan ruas jalan.');
        }
    })
    .catch(err => {
        console.error(err);
        showPopupMessage('Error saat simpan ruas jalan.');
    });
  });

  document.getElementById('nama_ruas').addEventListener('input', () => {
    const nama = document.getElementById('nama_ruas').value;
    let kode = nama
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    if (kode.length > 0) {
        document.getElementById('kode_ruas').value = kode;
    } else {
        document.getElementById('kode_ruas').value = '';
    }
  });

  function calculatePolylineLength(coords) {
    let total = 0;
    for (let i = 1; i < coords.length; i++) {
      const latlng1 = L.latLng(coords[i - 1]);
      const latlng2 = L.latLng(coords[i]);
      total += latlng1.distanceTo(latlng2);
    }
    return total.toFixed(2);
  }

  document.getElementById('finish-draw').addEventListener('click', () => {
    if (drawnPath.length < 2) {
      showPopupMessage('Minimal 2 titik untuk menggambar garis.');
      return;
    }

    const eksistingId = parseInt(selects.eksisting_id.value);
    const kondisiId = parseInt(selects.kondisi_id.value);
    const jenisId = parseInt(selects.jenisjalan_id.value);
    const style = getStyle(jenisId, kondisiId, eksistingId);

    if (previewLine) map.removeLayer(previewLine);
    previewLine = L.polyline(drawnPath, {
      color: style.color,
      weight: style.weight,
      dashArray: style.dashArray
    }).addTo(map);
    if (tempLine) {
      map.removeLayer(tempLine);
      tempLine = null;
    }
    const length = calculatePolylineLength(drawnPath);
    document.getElementById('panjang').value = length;
  });

  document.getElementById('undo-draw').addEventListener('click', () => {
    drawnPath.pop();
    if (previewLine) map.removeLayer(previewLine);
    if (tempLine) {
    map.removeLayer(tempLine);
    tempLine = null;
  }
    if (drawnPath.length > 1) {
      const style = getStyle(
        parseInt(selects.jenisjalan_id.value),
        parseInt(selects.kondisi_id.value),
        parseInt(selects.eksisting_id.value)
      );
      previewLine = L.polyline(drawnPath, style).addTo(map);
    }
  });

  document.getElementById('cancel-draw').addEventListener('click', () => {
    drawnPath.length = 0;
    if (previewLine) map.removeLayer(previewLine);
    if (tempLine) {
      map.removeLayer(tempLine);
      tempLine = null;
    }
    document.getElementById('panjang').value = '';
  });

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
});