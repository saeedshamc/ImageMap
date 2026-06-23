// --- Extended export: ZIP, PNG, SVG, frameworks ---
function coordsToPercent(coords, shape) {
    const w = imageNaturalWidth;
    const h = imageNaturalHeight;
    if (!w || !h) return coords;
    const nums = coords.split(',').map(Number);
    if (shape === 'rect') {
        return `${(nums[0] / w * 100).toFixed(2)}%,${(nums[1] / h * 100).toFixed(2)}%,${(nums[2] / w * 100).toFixed(2)}%,${(nums[3] / h * 100).toFixed(2)}%`;
    }
    if (shape === 'circle') {
        return `${(nums[0] / w * 100).toFixed(2)}%,${(nums[1] / h * 100).toFixed(2)}%,${(nums[2] / Math.min(w, h) * 100).toFixed(2)}%`;
    }
    if (shape === 'poly') {
        const out = [];
        for (let i = 0; i < nums.length; i += 2) {
            out.push(`${(nums[i] / w * 100).toFixed(2)}%`);
            out.push(`${(nums[i + 1] / h * 100).toFixed(2)}%`);
        }
        return out.join(',');
    }
    return coords;
}

function getExportCoords(area) {
    if (document.getElementById('percentCoordsToggle')?.checked) {
        return coordsToPercent(area.coords, area.shape);
    }
    return area.coords;
}

function buildMapHtmlForExport() {
    const name = getMapName();
    const src = getOutputImageSrc();
    const alt = getImageAlt();
    const responsive = document.getElementById('responsiveToggle')?.checked;
    const percent = document.getElementById('percentCoordsToggle')?.checked;

    let imgAttrs = `src="${escapeHtml(src)}"\n     usemap="#${name}"\n     alt="${escapeHtml(alt)}"`;
    if (imageNaturalWidth && imageNaturalHeight) {
        imgAttrs += `\n     width="${imageNaturalWidth}"\n     height="${imageNaturalHeight}"`;
    }
    if (responsive) {
        imgAttrs += `\n     style="max-width:100%; height:auto;"`;
    }

    let code = `<img ${imgAttrs}>\n\n<map name="${name}">`;
    if (areas.length === 0) {
        code += `\n  <!-- نواحی هنوز تعریف نشده‌اند -->`;
    } else {
        areas.forEach(area => {
            const coords = getExportCoords(area);
            code += `\n  <area shape="${area.shape}"`
                + `\n        coords="${escapeHtml(coords)}"`
                + `\n        href="${escapeHtml(area.href)}"`
                + `\n        alt="${escapeHtml(area.alt)}"`
                + (area.target ? `\n        target="${escapeHtml(area.target)}"` : '')
                + `>`;
        });
    }
    code += `\n</map>`;
    return code;
}

async function downloadZip() {
    if (!imageLoaded || typeof JSZip === 'undefined') {
        showToast('ابتدا عکس بارگذاری کنید', 'error');
        return;
    }
    const zip = new JSZip();
    const mapName = getMapName() || 'image-map';
    const imgPath = getOutputImageSrc().replace(/^\.\//, '') || 'images/map.jpg';

    zip.file('index.html', buildFullPageForExport());
    zip.file('README.txt', `Image Map - ${mapName}\n\n1. index.html را در مرورگر باز کنید\n2. مسیر عکس: ${imgPath}\n\nساخته شده با Image Map Builder\n`);

    if (imageSrc.startsWith('data:')) {
        const ext = imageSrc.match(/data:image\/(\w+)/)?.[1] || 'png';
        const base64 = imageSrc.split(',')[1];
        zip.file(imgPath.replace(/^\.?\/?/, ''), base64, { base64: true });
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mapName + '-package.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('بسته ZIP دانلود شد', 'success');
}

function buildFullPageForExport() {
    return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(getImageAlt())}</title>
<style>body{margin:0;font-family:sans-serif;} img{max-width:100%;height:auto;}</style>
</head>
<body>

${buildMapHtmlForExport()}

</body>
</html>`;
}

function downloadPreviewPng() {
    if (!imageLoaded) return;
    const canvas = document.createElement('canvas');
    canvas.width = imageNaturalWidth;
    canvas.height = imageNaturalHeight;
    const ctx = canvas.getContext('2d');
    const img = document.getElementById('mapImage');

    const draw = () => {
        ctx.drawImage(img, 0, 0);
        areas.forEach((area, i) => {
            const fill = getAreaColor(area, i);
            const stroke = getAreaBorderColor(area, i);
            ctx.fillStyle = fill;
            ctx.strokeStyle = stroke;
            ctx.lineWidth = 2;
            if (area.shape === 'rect') {
                const [x1, y1, x2, y2] = area.coords.split(',').map(Number);
                ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
                ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            } else if (area.shape === 'circle') {
                const [cx, cy, r] = area.coords.split(',').map(Number);
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            } else if (area.shape === 'poly') {
                const pts = area.coords.split(',').map(Number);
                ctx.beginPath();
                ctx.moveTo(pts[0], pts[1]);
                for (let j = 2; j < pts.length; j += 2) ctx.lineTo(pts[j], pts[j + 1]);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px sans-serif';
            const b = getAreaBounds(area);
            if (b) ctx.fillText(area.name, b.x1 + 4, b.y1 + 16);
        });
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = (getMapName() || 'map') + '-preview.png';
            a.click();
            URL.revokeObjectURL(url);
            showToast('PNG دانلود شد', 'success');
        });
    };

    if (img.complete) draw();
    else img.onload = draw;
}

function downloadPreviewSvg() {
    if (!imageLoaded) return;
    const w = imageNaturalWidth;
    const h = imageNaturalHeight;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    svg += `<image href="${imageSrc.startsWith('data:') ? imageSrc : escapeHtml(imageSrc)}" width="${w}" height="${h}"/>`;
    areas.forEach((area, i) => {
        const fill = getAreaBorderColor(area, i);
        if (area.shape === 'rect') {
            const [x1, y1, x2, y2] = area.coords.split(',').map(Number);
            svg += `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" fill="${fill}" fill-opacity="0.3" stroke="${fill}"/>`;
        } else if (area.shape === 'circle') {
            const [cx, cy, r] = area.coords.split(',').map(Number);
            svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" fill-opacity="0.3" stroke="${fill}"/>`;
        } else {
            const pts = area.coords.split(',').map(Number);
            let points = '';
            for (let j = 0; j < pts.length; j += 2) points += `${pts[j]},${pts[j + 1]} `;
            svg += `<polygon points="${points.trim()}" fill="${fill}" fill-opacity="0.3" stroke="${fill}"/>`;
        }
    });
    svg += '</svg>';
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (getMapName() || 'map') + '-preview.svg';
    a.click();
    URL.revokeObjectURL(url);
    showToast('SVG دانلود شد', 'success');
}

function exportReactComponent() {
    const areasJson = JSON.stringify(areas.map(a => ({
        shape: a.shape,
        coords: getExportCoords(a),
        href: a.href,
        alt: a.alt,
        target: a.target
    })), null, 2);
    const code = `import React from 'react';

const areas = ${areasJson};

export default function ImageMap() {
  return (
    <>
      <img src="${escapeHtml(getOutputImageSrc())}" useMap="#${getMapName()}" alt="${escapeHtml(getImageAlt())}" style={{ maxWidth: '100%', height: 'auto' }} />
      <map name="${getMapName()}">
        {areas.map((a, i) => (
          <area key={i} shape={a.shape} coords={a.coords} href={a.href} alt={a.alt} target={a.target} />
        ))}
      </map>
    </>
  );
}`;
    copyTextToClipboard(code, 'کامپوننت React کپی شد');
}

function exportVueComponent() {
    const areasJson = JSON.stringify(areas.map(a => ({
        shape: a.shape,
        coords: getExportCoords(a),
        href: a.href,
        alt: a.alt,
        target: a.target
    })), null, 2);
    const code = `<template>
  <img :src="imgSrc" :usemap="'#${getMapName()}'" :alt="alt" style="max-width:100%;height:auto" />
  <map name="${getMapName()}">
    <area v-for="(a, i) in areas" :key="i" :shape="a.shape" :coords="a.coords" :href="a.href" :alt="a.alt" :target="a.target" />
  </map>
</template>

<script>
export default {
  data() {
    return {
      imgSrc: '${escapeHtml(getOutputImageSrc())}',
      alt: '${escapeHtml(getImageAlt())}',
      areas: ${areasJson}
    };
  }
};
</script>`;
    copyTextToClipboard(code, 'کامپوننت Vue کپی شد');
}

function exportWordPressShortcode() {
    const code = `[imagemap name="${getMapName()}" src="${escapeHtml(getOutputImageSrc())}"]
${areas.map(a => `  [area shape="${a.shape}" coords="${getExportCoords(a)}" href="${escapeHtml(a.href)}" alt="${escapeHtml(a.alt)}"]`).join('\n')}
[/imagemap]`;
    copyTextToClipboard(code, 'Shortcode وردپرس کپی شد');
}

function copyTextToClipboard(text, msg) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(msg, 'success');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast(msg, 'success');
    });
}

function setFrameworkExport(type) {
    if (type === 'react') exportReactComponent();
    else if (type === 'vue') exportVueComponent();
    else if (type === 'wordpress') exportWordPressShortcode();
}
