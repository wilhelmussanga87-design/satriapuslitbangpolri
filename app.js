'use strict';
(() => {
  const data = window.SATRIA_DATA;
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const number = (value, digits = 2) => new Intl.NumberFormat('id-ID', {maximumFractionDigits:digits}).format(n(value));
  const rupiah = value => 'Rp ' + number(value, 0);
  const percent = (value, base) => n(base) > 0 ? n(value) / n(base) * 100 : null;
  const percentText = value => value === null ? 'Belum tersedia' : number(value) + '%';
  const moneyShort = value => Math.abs(n(value)) >= 1e9 ? 'Rp ' + number(n(value)/1e9) + ' M' : Math.abs(n(value)) >= 1e6 ? 'Rp ' + number(n(value)/1e6) + ' jt' : rupiah(value);
  const dateText = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? new Date(value+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}) : value || 'Belum tersedia';
  const pages = {
    ringkasan:['Ringkasan Pengendalian','Indikator utama, posisi anggaran, dan prioritas tindak lanjut.'],
    anggaran:['Anggaran & Realisasi','Pilih periode untuk membaca agregat Satker, jenis belanja, dan rincian bagian.'],
    paket:['Paket & Kartu Kendali','Capaian paket dibandingkan dengan target dalam basis data, bukan persentase terhadap pagu.'],
    risiko:['Manajemen Risiko','Pemetaan kemungkinan × dampak, pemilik risiko, dan langkah mitigasi.'],
    kontrak:['Monitoring Kontrak','Nilai kontrak, pembayaran, sisa, dan status sebagaimana tercatat pada sumber.'],
    milestone:['Milestone Proyek Perubahan','Jadwal, status tercatat, hasil, dan referensi eviden implementasi.'],
    arahan:['Catatan Arahan & Usulan','Catatan disajikan bersama akun pencatatnya. Usulan tidak otomatis merupakan keputusan yang telah disahkan KPA.'],
    dokumen:['Dokumen & Instrumen','Dokumen dari paket aplikasi. Status draf dan penanda isian di dalam dokumen tetap berlaku.'],
    galeri:['Galeri Kegiatan','Dokumentasi dan visual pendukung dari folder aset dashboard.'],
    tentang:['Informasi Data & Penggunaan','Sumber data, ambang pemantauan, dan cara memperbarui versi HTML.']
  };
  if (!data) {
    $('view').innerHTML='<p class="notice">Data belum termuat. Pastikan file <strong>data.js</strong> berada di folder yang sama dengan index.html, kemudian muat ulang halaman.</p>';
    $('snapshot-date').textContent='Data belum tersedia';
    return;
  }
  const cfg = Object.fromEntries(data.pengaturan.map(r=>[r.kunci,n(r.nilai)]));
  const setting = (key, fallback) => Object.hasOwn(cfg,key) ? cfg[key] : fallback;
  const levelRisk = score => score >= setting('risiko_merah',10) ? 'Merah' : score >= setting('risiko_kuning',5) ? 'Kuning' : 'Hijau';
  const levelCap = value => value === null ? 'Belum dinilai' : value < setting('capaian_merah',50) ? 'Merah' : value < setting('capaian_kuning',80) ? 'Kuning' : 'Hijau';
  const levelIkpa = value => value < setting('ikpa_merah',95) ? 'Merah' : value < setting('ikpa_kuning',97) ? 'Kuning' : 'Hijau';
  const pill = (text, level=text) => `<span class="pill ${{Merah:'red',Kuning:'yellow',Hijau:'green'}[level]||'neutral'}">${escape(text)}</span>`;
  const months=['januari','februari','maret','april','mei','juni','juli','agustus','september','oktober','november','desember'];
  function periodOrder(label){const parts=String(label).toLowerCase();const year=Number(parts.match(/\b20\d{2}\b/)?.[0]||0);const month=months.findIndex(m=>parts.includes(m));return year*12+month;}
  const periods=[...new Set(data.anggaran.map(r=>r.periode))].sort((a,b)=>periodOrder(b)-periodOrder(a)||a.localeCompare(b));
  const state={page:'ringkasan',period:periods[0]||'',q:'',status:''};
  let exportRows=[];
  function metric(label,value,detail){return `<article class="metric"><div class="metric-label">${escape(label)}</div><div class="metric-value">${escape(value)}</div><div class="metric-detail">${escape(detail)}</div></article>`;}
  function panel(title,html){return `<section class="panel"><h3>${escape(title)}</h3>${html}</section>`;}
  function empty(message='Belum ada data pada pilihan ini.'){return `<p class="empty">${escape(message)}</p>`;}
  function note(text){return `<p class="notice">${escape(text)}</p>`;}
  function source(value){return `<p class="source">Sumber: ${escape(value||'Belum dicantumkan')}</p>`;}
  function bar(label,value,description){const bounded=Math.min(100,Math.max(0,n(value)));return `<div><div class="bar-title"><span>${escape(label)}</span><strong>${escape(percentText(value))}</strong></div><div class="track" role="img" aria-label="${escape(label+': '+percentText(value))}"><div class="fill" style="width:${bounded}%"></div></div><div class="bar-note">${escape(description)}</div></div>`;}
  function table(columns,rows,caption){
    if(!rows.length)return empty();
    return `<div class="table-wrap" tabindex="0" role="region" aria-label="${escape(caption)}"><table><caption>${escape(caption)} · ${rows.length} baris</caption><thead><tr>${columns.map(c=>`<th scope="col">${escape(c.title)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(c=>`<td${c.num?' class="num"':''}>${c.render?c.render(r):escape(r[c.key]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function details(lines){return `<details><summary>Lihat rincian</summary>${lines.map(([label,value])=>`<p><strong>${escape(label)}:</strong> ${escape(value||'—')}</p>`).join('')}</details>`;}
  function match(row){return !state.q||Object.values(row).join(' ').toLocaleLowerCase('id-ID').includes(state.q.toLocaleLowerCase('id-ID'));}
  function searchControls(statuses=[]){
    $('controls').innerHTML=`<div class="field grow"><label for="search">Cari data pada halaman ini</label><input id="search" type="search" placeholder="Ketik nama, PIC, nomor, atau uraian…" value="${escape(state.q)}"></div>${statuses.length?`<div class="field"><label for="status">Status</label><select id="status"><option value="">Semua status</option>${statuses.map(s=>`<option${state.status===s?' selected':''}>${escape(s)}</option>`).join('')}</select></div>`:''}<button class="button secondary" type="button" id="csv">Unduh CSV</button>`;
    $('search').addEventListener('input',e=>{state.q=e.target.value;renderContent();});
    $('status')?.addEventListener('change',e=>{state.status=e.target.value;renderContent();});
    $('csv').addEventListener('click',downloadCSV);
  }
  function periodControls(){
    $('controls').innerHTML=`<div class="field"><label for="period">Periode anggaran</label><select id="period">${periods.map(p=>`<option${p===state.period?' selected':''}>${escape(p)}</option>`).join('')}</select></div>${state.page==='anggaran'?'<button class="button secondary" id="csv" type="button">Unduh CSV periode ini</button>':''}`;
    $('period').addEventListener('change',e=>{state.period=e.target.value;renderContent();});
    $('csv')?.addEventListener('click',downloadCSV);
  }
  function downloadCSV(){
    if(!exportRows.length)return;
    const keys=[...new Set(exportRows.flatMap(r=>Object.keys(r)))];
    const cell=value=>{let s=String(value??'');if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const csv='\uFEFF'+[keys,...exportRows.map(r=>keys.map(k=>r[k]))].map(row=>row.map(cell).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`SATRIA-${state.page}-${data.meta.generated_date}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function warnings(){
    const rows=[];
    const last=[...data.ikpa].sort((a,b)=>n(a.urutan)-n(b.urutan)).at(-1);
    if(last&&levelIkpa(last.nilai)!=='Hijau')rows.push({level:levelIkpa(last.nilai),title:'IKPA '+last.bulan,text:`Nilai ${number(last.nilai)} berdasarkan periode terakhir yang tersedia.`});
    data.paket.forEach(p=>{const cap=percent(p.realisasi,p.target),level=levelCap(cap);if(['Merah','Kuning'].includes(level))rows.push({level,title:p.nama,text:`Capaian ${percentText(cap)} terhadap target. PIC: ${p.ppk}.`});if(p.catatan?.includes('[PERIKSA'))rows.push({level:'Kuning',title:'Verifikasi paket '+p.no,text:p.catatan});});
    data.kontrak.filter(k=>String(k.status).toUpperCase().includes('TERLAMBAT')).forEach(k=>rows.push({level:'Merah',title:k.nomor,text:'Status tercatat: '+k.status}));
    data.risiko.filter(r=>levelRisk(n(r.k)*n(r.d))==='Merah').forEach(r=>rows.push({level:'Merah',title:r.id+' · '+r.sasaran,text:`Skor ${n(r.k)*n(r.d)}; PIC ${r.pic}. Lapor KPA 1 × 24 jam.`}));
    data.milestone.filter(m=>m.status!=='Terlaksana'&&/^\d{4}-\d{2}-\d{2}$/.test(m.tanggal)&&m.tanggal<data.meta.generated_date).forEach(m=>rows.push({level:'Merah',title:m.kode+' · '+m.nama,text:'Jadwal telah lewat pada tanggal ekspor; status tercatat '+m.status+'. Perlu konfirmasi kemajuan.'}));
    return rows;
  }
  function summary(){
    const aggregates=data.anggaran.filter(r=>r.periode===state.period&&r.kategori==='AGREGAT');const a=aggregates[0];
    const last=[...data.ikpa].sort((a,b)=>n(a.urutan)-n(b.urutan)).at(-1);
    const red=data.risiko.filter(r=>levelRisk(n(r.k)*n(r.d))==='Merah').length;
    const jenis=data.anggaran.filter(r=>r.periode===state.period&&r.kategori==='JENIS');
    const alerts=warnings();
    return `<div class="metrics">${metric('Pagu Satker · '+(state.period||'—'),a?moneyShort(a.pagu):'Belum tersedia',a?rupiah(a.pagu):'Belum ada agregat periode ini')}${metric('Realisasi anggaran',a?percentText(percent(a.realisasi,a.pagu)):'—',a?rupiah(a.realisasi):'Tidak dihitung dari penjumlahan kategori')}${metric('IKPA terakhir',last?number(last.nilai):'—',last?last.bulan+' · '+levelIkpa(last.nilai):'Belum ada data IKPA')}${metric('Risiko merah',String(red),`Dari ${data.risiko.length} risiko tercatat`)}</div>
      ${aggregates.length>1?note('Terdapat lebih dari satu baris agregat pada periode ini; ringkasan menggunakan baris pertama. Periksa rincian pada menu Anggaran.'):''}
      <div class="columns"><div>${panel('Realisasi per jenis belanja',jenis.length?`<div class="bars">${jenis.map(r=>bar(r.uraian,percent(r.realisasi,r.pagu),rupiah(r.realisasi)+' dari '+rupiah(r.pagu))).join('')}</div><p class="chart-legend">Persentase realisasi terhadap pagu masing-masing jenis belanja.</p>`:empty('Rincian jenis belanja untuk periode ini belum tersedia.'))}${a?source(a.sumber):''}</div>
      ${panel('Tren IKPA',data.ikpa.length?`<div class="chart" role="img" aria-label="Tren IKPA. Angka ditampilkan pada setiap batang.">${[...data.ikpa].sort((a,b)=>n(a.urutan)-n(b.urutan)).map(r=>`<div class="chart-col"><div class="chart-value">${number(r.nilai)}</div><div class="chart-bar" style="height:${Math.min(100,Math.max(0,n(r.nilai)))*1.35}px"></div><div class="chart-label">${escape(r.bulan)}</div></div>`).join('')}</div><p class="chart-legend">Skala 0–100. Periode IKPA dapat berbeda dari periode anggaran yang dipilih.</p>`:empty())}</div>
      ${panel('Prioritas perhatian',alerts.length?`<ul class="alerts">${alerts.map(r=>`<li>${pill(r.level)}<div><strong>${escape(r.title)}</strong>${escape(r.text)}</div></li>`).join('')}</ul>`:empty('Tidak ada peringatan berdasarkan data dan ambang pada ekspor ini.'))}
      <div class="metrics">${metric('Paket sasaran',String(data.paket.length),'Lingkup tersendiri dari agregat Satker')}${metric('Kontrak tercatat',String(data.kontrak.length),'Status mengikuti data sumber')}${metric('Milestone terlaksana',data.milestone.filter(m=>m.status==='Terlaksana').length+' / '+data.milestone.length,'Berdasarkan status tercatat')}${metric('Dokumen tersedia',String(data.documents.length),'Instrumen dan panduan unduh')}</div>`;
  }
  function budget(){
    const rows=data.anggaran.filter(r=>r.periode===state.period);exportRows=rows;
    let html=note('Kategori AGREGAT, JENIS, dan BAGIAN adalah sudut pandang berbeda. Jangan dijumlahkan bersama karena dapat menghitung anggaran yang sama berulang kali.');
    const a=rows.find(r=>r.kategori==='AGREGAT');
    if(a)html+=`<div class="metrics">${metric('Pagu',moneyShort(a.pagu),rupiah(a.pagu))}${metric('Realisasi',moneyShort(a.realisasi),rupiah(a.realisasi))}${metric('Sisa tercatat',moneyShort(a.sisa),rupiah(a.sisa))}${metric('Penyerapan',percentText(percent(a.realisasi,a.pagu)),state.period)}</div>`;
    const cols=[{key:'uraian',title:'Uraian'},{title:'Pagu',num:true,render:r=>rupiah(r.pagu)},{title:'Realisasi',num:true,render:r=>rupiah(r.realisasi)},{title:'Sisa tercatat',num:true,render:r=>rupiah(r.sisa)},{title:'Penyerapan',num:true,render:r=>percentText(percent(r.realisasi,r.pagu))},{title:'Sumber',render:r=>details([['Sumber',r.sumber]])}];
    for(const cat of ['AGREGAT','JENIS','BAGIAN']){const group=rows.filter(r=>r.kategori===cat);if(group.length)html+=table(cols,group,cat+' · '+state.period);}
    const issues=rows.filter(r=>Math.abs(n(r.pagu)-n(r.realisasi)-n(r.sisa))>1);
    if(issues.length)html+=note('Perlu rekonsiliasi pagu − realisasi dengan sisa tercatat: '+issues.map(r=>r.uraian).join('; '));
    return html+(rows.length?'':empty());
  }
  function packages(){
    const rows=data.paket.map(p=>({...p,capaian:percent(p.realisasi,p.target),level:levelCap(percent(p.realisasi,p.target))})).filter(r=>match(r)&&(!state.status||r.level===state.status));exportRows=rows;
    return table([{key:'no',title:'No.'},{title:'Paket / PPK',render:r=>`<strong>${escape(r.nama)}</strong><p>${escape(r.ppk)}</p>`},{title:'Pagu',num:true,render:r=>rupiah(r.pagu)},{title:'Target',num:true,render:r=>rupiah(r.target)},{title:'Realisasi',num:true,render:r=>rupiah(r.realisasi)},{title:'Capaian target',render:r=>`${percentText(r.capaian)}<br>${pill(r.level)}`},{title:'Kartu informasi',render:r=>details([['Kontrak',r.kontrak],['Catatan',r.catatan],['Sumber/periode',r.sumber],['Diperbarui',r.diperbarui]])}],rows,'Paket sasaran dan informasi pengendalian')+note('Data paket memiliki periode/sumber tersendiri. Kartu informasi ini menampilkan data yang tersedia; instrumen Kartu Kendali Bulanan lengkap dapat diunduh melalui menu Dokumen.');
  }
  function risks(){
    const rows=data.risiko.map(r=>({...r,skor:n(r.k)*n(r.d),level:levelRisk(n(r.k)*n(r.d))})).filter(r=>match(r)&&(!state.status||r.level===state.status));exportRows=rows;
    let matrix='<div class="axis">K↓ D→</div>'+[1,2,3,4,5].map(x=>`<div class="axis">${x}</div>`).join('');
    for(let k=5;k>=1;k--){matrix+=`<div class="axis">${k}</div>`;for(let d=1;d<=5;d++){const inCell=rows.filter(r=>n(r.k)===k&&n(r.d)===d);const l=levelRisk(k*d);matrix+=`<div class="matrix-cell ${{Merah:'red',Kuning:'yellow',Hijau:'green'}[l]}" title="${escape(inCell.map(r=>r.id).join(', ')||'Tidak ada risiko')}"><strong>${k*d}</strong><small>${inCell.length?inCell.length+' risiko':'—'}</small></div>`;}}
    return `<div class="columns">${panel('Matriks kemungkinan × dampak',`<div class="matrix">${matrix}</div><p class="chart-legend">K = kemungkinan; D = dampak. Jumlah risiko mengikuti filter halaman.</p>`)}${panel('Aturan eskalasi',`<p>${pill('Merah')} Skor ≥ ${setting('risiko_merah',10)}. Risiko merah dilaporkan kepada KPA paling lambat <strong>1 × 24 jam</strong> sejak diketahui.</p><p>${pill('Kuning')} Skor ≥ ${setting('risiko_kuning',5)} dan di bawah ambang merah.</p><p class="muted">Halaman ini menampilkan status; tidak mengirim laporan atau notifikasi otomatis kepada KPA.</p>`)}</div>`+table([{key:'id',title:'ID'},{title:'Sasaran / risiko',render:r=>`<strong>${escape(r.sasaran)}</strong><p>${escape(r.risiko)}</p>`},{title:'K × D',num:true,render:r=>`${n(r.k)} × ${n(r.d)} = ${r.skor}<br>${pill(r.level)}`},{key:'mitigasi',title:'Mitigasi'},{key:'pic',title:'PIC'},{key:'tenggat',title:'Tenggat'},{title:'Rincian',render:r=>details([['Dampak',r.dampak],['Pengendalian',r.pengendalian],['Status/catatan',r.status],['Pembaruan',r.diperbarui]])}],rows,'Register risiko');
  }
  function contracts(){
    const rows=data.kontrak.filter(r=>match(r)&&(!state.status||r.status===state.status));exportRows=rows;
    return table([{title:'Kontrak',render:r=>`<strong>${escape(r.nomor)}</strong><p>${escape(r.supplier)}</p>`},{title:'Nilai',num:true,render:r=>rupiah(r.nilai)},{title:'Dibayar',num:true,render:r=>rupiah(r.dibayar)},{title:'Sisa tercatat',num:true,render:r=>rupiah(r.sisa)},{title:'Status',render:r=>pill(r.status,String(r.status).includes('TERLAMBAT')?'Merah':String(r.status).startsWith('SELESAI')?'Hijau':'Kuning')},{title:'Rincian kontrak',render:r=>details([['Uraian',r.uraian],['Tanggal kontrak',r.tanggal_kontrak],['Mulai',r.mulai],['Selesai',r.selesai],['Paket',r.paket_no],['Sumber',r.sumber]])}],rows,'Monitoring kontrak')+note('Status kontrak disalin dari sumber dan tidak diubah otomatis berdasarkan tanggal hari ini.');
  }
  function milestones(){
    const rows=[...data.milestone].sort((a,b)=>a.tanggal.localeCompare(b.tanggal)).filter(r=>match(r)&&(!state.status||r.status===state.status));exportRows=rows;
    if(!rows.length)return empty();
    return panel('Tahapan implementasi',`<div class="timeline">${rows.map(r=>`<article class="timeline-item"><div class="timeline-date">${escape(dateText(r.tanggal))}</div><div class="timeline-content"><h3>${escape(r.kode)} · ${escape(r.nama)}</h3>${pill(r.status,r.status==='Terlaksana'?'Hijau':r.status==='Dijalankan'?'Kuning':'')}<p class="preline">${escape(r.hasil||'Hasil belum dicatat.')}</p><p class="source">Referensi eviden: ${escape(r.eviden||'Belum dicatat')}</p></div></article>`).join('')}</div>`)+note('Referensi eviden adalah teks dari basis data; penyebutan nama file tidak otomatis membuktikan bahwa dokumen telah tersedia atau disahkan.');
  }
  function decisions(){
    const rows=[...data.keputusan].sort((a,b)=>String(b.waktu).localeCompare(String(a.waktu))).filter(match);exportRows=rows;
    return table([{key:'waktu',title:'Waktu pencatatan'},{key:'pengguna',title:'Akun pencatat'},{key:'objek',title:'Objek'},{key:'opsi',title:'Arahan / opsi'},{key:'dasar',title:'Dasar / catatan'},{key:'tenggat',title:'Tenggat'}],rows,'Catatan arahan dan usulan')+note('Untuk mencatat atau mengesahkan keputusan baru, gunakan aplikasi SATRIA asli. Halaman HTML ini tidak menyediakan pengesahan maupun perubahan data.');
  }
  function documents(){
    const rows=data.documents.filter(match);exportRows=rows;
    return rows.length?`<div class="document-grid">${rows.map(r=>`<article class="doc-card">${pill(r.type.toUpperCase())}<h3>${escape(r.name)}</h3><small>${number(r.bytes/1024,0)} KB · Salinan dokumen aplikasi</small><a class="button secondary" href="${escape(r.url)}" download>Unduh dokumen</a></article>`).join('')}</div>`:empty();
  }
  function gallery(){
    const rows=data.gallery.filter(r=>match(r)&&(!state.status||r.group===state.status));exportRows=rows;
    return rows.length?`<div class="gallery">${rows.map(r=>`<figure><button class="photo-button" type="button" data-photo="${escape(r.url)}" data-caption="${escape(r.name)}" aria-label="Perbesar: ${escape(r.name)}"><img src="${escape(r.url)}" alt="${escape(r.name)}" loading="lazy"></button><figcaption>${escape(r.name)}<br><small>${escape(r.group)}</small></figcaption></figure>`).join('')}</div>`:empty();
  }
  function about(){return panel('Tentang publikasi ini',`<p>Dashboard HTML menampilkan salinan data dari <strong>basis data aplikasi SATRIA</strong>. Ekspor dibuat pada ${escape(data.meta.generated_at)}. Periode dan status pada masing-masing modul dapat berbeda.</p><ul class="info-list"><li>Anggaran: ${escape(periods.join(', ')||'belum tersedia')}.</li><li>Paket, kontrak, dan risiko: lihat keterangan sumber pada setiap baris.</li><li>Tidak ada sinkronisasi otomatis, akun login, penyuntingan bersama, maupun pengiriman notifikasi dalam versi HTML.</li><li>Data diperbarui pada aplikasi asli, lalu diekspor ulang dengan <strong>Perbarui-HTML.bat</strong>. Unggah kembali isi folder public_html ke hosting.</li><li>Pencarian, filter, unduh CSV, unduh dokumen, galeri, dan cetak berjalan di browser.</li></ul>`)+panel('Ambang peringatan',table([{key:'kunci',title:'Indikator'},{key:'nilai',title:'Nilai'},{key:'keterangan',title:'Keterangan'}],data.pengaturan,'Pengaturan dari aplikasi'))+panel('Sumber & catatan',`<p>Seluruh nilai berasal dari data lokal yang diekspor; tidak diganti dengan angka contoh. Penanda [ISI], [PERIKSA], dan [VERIFIKASI] dipertahankan sebagaimana sumbernya. Nilai aktual perlu diperbarui oleh pengelola melalui aplikasi asli.</p><p class="source">Judul tampilan mengikuti README aplikasi. Identitas proyek: Wilhelmus Sanga, S.E., M.M. · Puslitbang Polri · PKN Tingkat II Tahun 2026.</p>`);}
  const renderers={ringkasan:summary,anggaran:budget,paket:packages,risiko:risks,kontrak:contracts,milestone:milestones,arahan:decisions,dokumen:documents,galeri:gallery,tentang:about};
  function renderContent(){exportRows=[];$('view').innerHTML=renderers[state.page]();if($('csv'))$('csv').disabled=!exportRows.length;}
  function route(){
    const requested=location.hash.slice(1);state.page=Object.hasOwn(pages,requested)?requested:'ringkasan';state.q='';state.status='';
    document.querySelectorAll('#navigation a').forEach(a=>{if(a.hash==='#'+state.page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    $('page-title').textContent=pages[state.page][0];$('page-description').textContent=pages[state.page][1];document.title=pages[state.page][0]+' — SATRIA Puslitbang';
    $('controls').innerHTML='';
    if(['ringkasan','anggaran'].includes(state.page))periodControls();
    else if(state.page!=='tentang'){
      const statuses=['paket','risiko'].includes(state.page)?['Merah','Kuning','Hijau',...(state.page==='paket'?['Belum dinilai']:[])]:state.page==='kontrak'?[...new Set(data.kontrak.map(r=>r.status))]:state.page==='milestone'?[...new Set(data.milestone.map(r=>r.status))]:state.page==='galeri'?[...new Set(data.gallery.map(r=>r.group))]:[];
      searchControls(statuses);
    }
    renderContent();
  }
  $('snapshot-date').textContent='Ekspor data: '+data.meta.generated_at;
  $('footer-date').textContent='Versi ekspor '+data.meta.generated_date;
  $('print').addEventListener('click',()=>window.print());
  $('view').addEventListener('click',event=>{const button=event.target.closest('[data-photo]');if(!button)return;$('full-photo').src=button.dataset.photo;$('full-photo').alt=button.dataset.caption;$('photo-caption').textContent=button.dataset.caption;$('photo-dialog').showModal();});
  $('close-photo').addEventListener('click',()=>$('photo-dialog').close());
  window.addEventListener('hashchange',route);route();
})();
