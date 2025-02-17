const fileInput = document.getElementById('fileInput');
const metadataOutput = document.getElementById('metadataOutput');
const metadataContainer = document.getElementById('metadataContainer');
const toggleMetadataBtn = document.getElementById('toggleMetadataBtn');
const xmpOutput = document.getElementById('xmpOutput');
const cameraInfoDiv = document.getElementById('cameraInfo');
const sliderKnobs = {};

function getSliderKnob(id) {
  if (!sliderKnobs[id]) {
    sliderKnobs[id] = document.getElementById(id);
  }
  return sliderKnobs[id];
}

let fileDataUrl = "";

function formatExposure(exposure) {
  if (!exposure) return "N/A";
  if (exposure >= 1) return exposure.toFixed(1) + " сек";
  const reciprocal = Math.round(1 / exposure);
  return "1/" + reciprocal + " сек";
}

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return d.toLocaleString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function processToneCurveValue(value) {
  if (Array.isArray(value)) {
    if (value.every(el => typeof el === "string" && el.includes(","))) {
      return value.join("; ");
    }
    if (value.length > 0 && Array.isArray(value[0])) {
      return value.map(point => point.join(",")).join(";");
    }
    return value.join(", ");
  }
  return value;
}

function formatValue(key, value) {
  if (key.startsWith("ToneCurve")) {
    return processToneCurveValue(value);
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return value;
}

function displayCameraInfo(meta) {
  const make = meta.Make || "Неизвестно";
  const model = meta.Model || "Неизвестно";
  // Попробуйте получить информацию об объективе из LensModel или Lens
  const lens = meta.LensModel || meta.Lens || "";
  const exposure = meta.ExposureTime ? formatExposure(meta.ExposureTime) : "N/A";
  const aperture = meta.FNumber ? "f/" + meta.FNumber : "N/A";
  const iso = meta.ISOSpeedRatings || meta.ISO || "N/A";
  const date = meta.DateTimeOriginal ? formatDate(meta.DateTimeOriginal) : "N/A";
  const lensInfo = lens ? `<p><strong>Объектив:</strong> ${lens}</p>` : "";
  const infoHtml = `
<div class="info">
  <h2>Информация о съёмке</h2>
  <p><strong>Камера:</strong> ${make} ${model}</p>
  ${lensInfo}
  <p><strong>Настройки:</strong> Экспозиция ${exposure}, ${aperture}, ISO ${iso}</p>
  <p><strong>Дата съёмки:</strong> ${date}</p>
</div>
`;
  const previewHtml = fileDataUrl ? `<div class="preview"><img src="${fileDataUrl}" alt="Предпросмотр"></div>` : "";
  cameraInfoDiv.innerHTML = previewHtml + infoHtml;
}

function displayFallback(meta) {
  xmpOutput.innerHTML = `<div class="message"><p>стырить не получится :(</p></div>`;
}

function displayMetadata(metadata) {
  let tableHTML = '<table>';
  tableHTML += '<tr><th>Настройка</th><th>Значение</th></tr>';
  for (let key in metadata) {
    tableHTML += `<tr><td>${key}</td><td>${metadata[key]}</td></tr>`;
  }
  tableHTML += '</table>';
  metadataOutput.innerHTML = tableHTML;
}

function generateXMP(lrData) {
  let xml = `<?xpacket begin='﻿' id='W5M0MpCehiHzreSzNTczkc9d'?>\n`;
  xml += `<x:xmpmeta xmlns:x="adobe:ns:meta/">\n`;
  xml += `  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n`;
  xml += `    <rdf:Description rdf:about=""\n`;
  xml += `      xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"\n`;
  for (let key in lrData) {
    xml += `      crs:${key}="${lrData[key]}"\n`;
  }
  xml += `    />\n`;
  xml += `  </rdf:RDF>\n`;
  xml += `</x:xmpmeta>\n`;
  xml += `<?xpacket end='w'?>`;
  return xml;
}

function generateXMPButton(lrData) {
  const xmpData = generateXMP(lrData);
  const blob = new Blob([xmpData], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  xmpOutput.innerHTML = `<a href="${url}" download="LightroomPreset.xmp" class="btn-download">Скачать XMP пресет для Lightroom</a>`;
}

// Нормализация: Temperature: 2000–50000, Tint: -150…150, Exposure2012: -5.00…+5.00, остальные: -100…100
function normalizeSliderValue(key, value) {
  let numericValue = parseFloat(value);
  if (isNaN(numericValue)) return 50;
  let percentage;
  switch (key) {
    case 'Temperature':
      percentage = ((numericValue - 2000) / (50000 - 2000)) * 100;
      break;
    case 'Tint':
      percentage = ((numericValue + 150) / 300) * 100;
      break;
    case 'Exposure2012':
      percentage = ((numericValue + 5) / 10) * 100;
      break;
    case 'Contrast2012':
    case 'Highlights2012':
    case 'Shadows2012':
    case 'Whites2012':
    case 'Blacks2012':
    case 'Texture':
    case 'Clarity2012':
    case 'Dehaze':
    case 'Vibrance':
    case 'Saturation':
      percentage = ((numericValue + 100) / 200) * 100;
      break;
    // HSL и калибровка (диапазон -100…100)
    case 'HueAdjustmentRed':
    case 'HueAdjustmentOrange':
    case 'HueAdjustmentYellow':
    case 'HueAdjustmentGreen':
    case 'HueAdjustmentAqua':
    case 'HueAdjustmentBlue':
    case 'HueAdjustmentPurple':
    case 'HueAdjustmentMagenta':
    case 'SaturationAdjustmentRed':
    case 'SaturationAdjustmentOrange':
    case 'SaturationAdjustmentYellow':
    case 'SaturationAdjustmentGreen':
    case 'SaturationAdjustmentAqua':
    case 'SaturationAdjustmentBlue':
    case 'SaturationAdjustmentPurple':
    case 'SaturationAdjustmentMagenta':
    case 'LuminanceAdjustmentRed':
    case 'LuminanceAdjustmentOrange':
    case 'LuminanceAdjustmentYellow':
    case 'LuminanceAdjustmentGreen':
    case 'LuminanceAdjustmentAqua':
    case 'LuminanceAdjustmentBlue':
    case 'LuminanceAdjustmentPurple':
    case 'LuminanceAdjustmentMagenta':
    case 'ShadowTint':
    case 'RedHue':
    case 'GreenHue':
    case 'BlueHue':
      percentage = ((numericValue + 100) / 200) * 100;
      break;
    case 'RedSaturation':
    case 'GreenSaturation':
    case 'BlueSaturation':
      percentage = ((numericValue + 100) / 200) * 100;
      break;
    default:
      percentage = ((numericValue + 100) / 200) * 100;
  }
  return Math.max(0, Math.min(100, percentage));
}

// Переключатель таблицы XMP
toggleMetadataBtn.addEventListener('click', () => {
  if (metadataContainer.style.display === "none" || metadataContainer.style.display === "") {
    metadataContainer.style.display = "block";
    toggleMetadataBtn.textContent = "Скрыть XMP таблицу";
  } else {
    metadataContainer.style.display = "none";
    toggleMetadataBtn.textContent = "Показать XMP таблицу";
  }
});

fileInput.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (event) {
    fileDataUrl = event.target.result;
    processFile(file);
  };
  reader.readAsDataURL(file);
});

function processFile(file) {
  metadataOutput.innerHTML = "";
  xmpOutput.innerHTML = "";
  cameraInfoDiv.innerHTML = "";
  const THRESHOLD = 5;
  exifr.parse(file, { xmp: true, exif: true }).then(meta => {
    if (!meta) {
      metadataOutput.innerHTML = "<p class='message'>Метаданные не обнаружены в файле.</p>";
      return;
    }
    displayCameraInfo(meta);
    const baseKeys = [
      'Version', 'ProcessVersion', 'WhiteBalance', 'Temperature', 'Tint', 'Exposure2012',
      'Contrast2012', 'Highlights2012', 'Shadows2012', 'Whites2012', 'Blacks2012', 'Texture',
      'Clarity2012', 'Dehaze', 'Vibrance', 'Saturation', 'ParametricShadows', 'ParametricDarks',
      'ParametricLights', 'ParametricHighlights', 'ParametricShadowSplit', 'ParametricMidtoneSplit',
      'ParametricHighlightSplit', 'Sharpness', 'SharpenRadius', 'SharpenDetail', 'SharpenEdgeMasking',
      'LuminanceSmoothing', 'ColorNoiseReduction', 'ColorNoiseReductionDetail', 'ColorNoiseReductionSmoothness'
    ];
    const toneCurveKeys = [
      'ToneCurveName2012', 'ToneCurvePV2012', 'ToneCurvePV2012Red', 'ToneCurvePV2012Green', 'ToneCurvePV2012Blue'
    ];
    const colors = ['Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta'];
    const hslHueKeys = colors.map(color => 'HueAdjustment' + color);
    const hslSaturationKeys = colors.map(color => 'SaturationAdjustment' + color);
    const hslLuminanceKeys = colors.map(color => 'LuminanceAdjustment' + color);
    const splitToningKeys = [
      'SplitToningShadowHue', 'SplitToningShadowSaturation', 'SplitToningHighlightHue',
      'SplitToningHighlightSaturation', 'SplitToningBalance'
    ];
    const calibrationKeys = [
      'RedHue', 'RedSaturation', 'GreenHue', 'GreenSaturation', 'BlueHue', 'BlueSaturation', 'ShadowTint'
    ];
    const colorGradeKeys = [
      'ColorGradeMidtoneHue', 'ColorGradeMidtoneSat', 'ColorGradeShadowLum',
      'ColorGradeMidtoneLum', 'ColorGradeHighlightLum', 'ColorGradeBlending',
      'ColorGradeGlobalHue', 'ColorGradeGlobalSat', 'ColorGradeGlobalLum'
    ];
    const extraKeys = ['PointColors'];
    const lrKeys = [].concat(
      baseKeys, toneCurveKeys, hslHueKeys, hslSaturationKeys, hslLuminanceKeys,
      splitToningKeys, calibrationKeys, colorGradeKeys, extraKeys
    );
    let lrData = {};
    lrKeys.forEach(key => {
      if (meta[key] !== undefined) {
        lrData[key] = formatValue(key, meta[key]);
      }
    });
    if (Object.keys(lrData).length < THRESHOLD) {
      displayFallback(meta);
      displayMetadata(lrData);
    } else {
      generateXMPButton(lrData);
      displayMetadata(lrData);
    }
    // Обновление слайдеров
    for (const key in lrData) {
      if (sliderMap[key]) {
        const sliderKnobId = sliderMap[key];
        const sliderKnob = getSliderKnob(sliderKnobId);
        if (sliderKnob) {
          const percentage = normalizeSliderValue(key, meta[key]);
          sliderKnob.style.left = percentage + '%';
          const sliderValueId = sliderKnobId.replace('Knob', 'Value');
          const sliderValueElem = document.getElementById(sliderValueId);
          if (sliderValueElem) {
            let numericValue = parseFloat(meta[key]);
            if (isNaN(numericValue)) numericValue = 0;
            let formattedValue;
            if (key === 'Exposure2012') {
              formattedValue = (numericValue > 0 ? "+" : "") + numericValue.toFixed(2);
            } else if (key === 'Temperature') {
              formattedValue = numericValue;
            } else if (
              key.startsWith("HueAdjustment") || key.startsWith("SaturationAdjustment") ||
              key.startsWith("LuminanceAdjustment") || key.startsWith("RedHue") ||
              key.startsWith("GreenHue") || key.startsWith("BlueHue") ||
              key.startsWith("RedSaturation") || key.startsWith("GreenSaturation") ||
              key.startsWith("BlueSaturation") || key === "ShadowTint"
            ) {
              formattedValue = (numericValue > 0 ? "+" : "") + numericValue;
            } else {
              formattedValue = (numericValue > 0 ? "+" : "") + numericValue;
            }
            sliderValueElem.textContent = formattedValue;
          }
        }
      }
    }
  }).catch(error => {
    console.error(error);
    metadataOutput.innerHTML = "<p class='message'>Ошибка при извлечении метаданных.</p>";
  });
}

const sliderMap = {
  Temperature: 'tempSliderKnob',
  Tint: 'tintSliderKnob',
  Exposure2012: 'exposureSliderKnob',
  Contrast2012: 'contrastSliderKnob',
  Highlights2012: 'highlightsSliderKnob',
  Shadows2012: 'shadowsSliderKnob',
  Whites2012: 'whitesSliderKnob',
  Blacks2012: 'blacksSliderKnob',
  Texture: 'textureSliderKnob',
  Clarity2012: 'claritySliderKnob',
  Dehaze: 'dehazeSliderKnob',
  Vibrance: 'vibranceSliderKnob',
  Saturation: 'saturationSliderKnob',
  HueAdjustmentRed: 'hueRedSliderKnob',
  HueAdjustmentOrange: 'hueOrangeSliderKnob',
  HueAdjustmentYellow: 'hueYellowSliderKnob',
  HueAdjustmentGreen: 'hueGreenSliderKnob',
  HueAdjustmentAqua: 'hueAquaSliderKnob',
  HueAdjustmentBlue: 'hueBlueSliderKnob',
  HueAdjustmentPurple: 'huePurpleSliderKnob',
  HueAdjustmentMagenta: 'hueMagentaSliderKnob',
  SaturationAdjustmentRed: 'saturationRedSliderKnob',
  SaturationAdjustmentOrange: 'saturationOrangeSliderKnob',
  SaturationAdjustmentYellow: 'saturationYellowSliderKnob',
  SaturationAdjustmentGreen: 'saturationGreenSliderKnob',
  SaturationAdjustmentAqua: 'saturationAquaSliderKnob',
  SaturationAdjustmentBlue: 'saturationBlueSliderKnob',
  SaturationAdjustmentPurple: 'saturationPurpleSliderKnob',
  SaturationAdjustmentMagenta: 'saturationMagentaSliderKnob',
  LuminanceAdjustmentRed: 'luminanceRedSliderKnob',
  LuminanceAdjustmentOrange: 'luminanceOrangeSliderKnob',
  LuminanceAdjustmentYellow: 'luminanceYellowSliderKnob',
  LuminanceAdjustmentGreen: 'luminanceGreenSliderKnob',
  LuminanceAdjustmentAqua: 'luminanceAquaSliderKnob',
  LuminanceAdjustmentBlue: 'luminanceBlueSliderKnob',
  LuminanceAdjustmentPurple: 'luminancePurpleSliderKnob',
  LuminanceAdjustmentMagenta: 'luminanceMagentaSliderKnob',
  ShadowTint: 'calibrationShadowHueSliderKnob',
  RedHue: 'calibrationRedHueSliderKnob',
  RedSaturation: 'calibrationRedSaturationSliderKnob',
  GreenHue: 'calibrationGreenHueSliderKnob',
  GreenSaturation: 'calibrationGreenSaturationSliderKnob',
  BlueHue: 'calibrationBlueHueSliderKnob',
  BlueSaturation: 'calibrationBlueSaturationSliderKnob'
};
// Предотвращаем стандартное поведение для drag & drop событий
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  document.addEventListener(eventName, function (e) {
    e.preventDefault();
    e.stopPropagation();
  });
});

// При входе в зону перетаскивания – показываем глобальную область
document.addEventListener('dragenter', function (e) {
  document.getElementById('globalDropZone').classList.add('visible');
});

// При уходе курсора – скрываем область (можно добавить дополнительную проверку, если нужно)
document.addEventListener('dragleave', function (e) {
  document.getElementById('globalDropZone').classList.remove('visible');
});

// При отпускании файла – скрываем область и обрабатываем файл
document.addEventListener('drop', function (e) {
  document.getElementById('globalDropZone').classList.remove('visible');
  const dt = e.dataTransfer;
  const files = dt.files;
  if (files.length) {
    const file = files[0];
    const reader = new FileReader();
    reader.onload = function (event) {
      fileDataUrl = event.target.result;
      processFile(file);
    };
    reader.readAsDataURL(file);
  }
});

// Dark mode toggle
const darkModeToggle = document.getElementById('darkModeToggle');
darkModeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-theme');
  if (document.body.classList.contains('dark-theme')) {
    darkModeToggle.textContent = 'Светлая тема';
  } else {
    darkModeToggle.textContent = 'Тёмная тема';
  }
});
