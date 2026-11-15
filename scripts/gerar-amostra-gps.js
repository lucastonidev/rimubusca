import fs from 'fs';
import path from 'path';

// Garante que o diretório public/samples existe
const samplesDir = path.resolve('public/samples');
if (!fs.existsSync(samplesDir)) {
  fs.mkdirSync(samplesDir, { recursive: true });
}

/**
 * Constrói um JPEG 1x1 mínimo com bloco APP1 EXIF + GPS TIFF válido
 */
function createJpegWithGpsExif() {
  // Coordenadas: São Paulo, Brasil (-23.550520, -46.633308), Altitude: 760m
  // Latitude: 23° 33' 1.872" S
  // Longitude: 46° 37' 59.908" W

  // Vamos montar o TIFF Header e IFDs (Little Endian: II)
  // Header: II (0x4949) + 42 (0x002A) + offset IFD0 (0x00000008)
  
  // Criamos um buffer dinâmico para o TIFF
  const tiff = Buffer.alloc(1024);
  let pos = 0;

  // Header TIFF
  tiff.write('II', pos); pos += 2; // Little-endian
  tiff.writeUInt16LE(42, pos); pos += 2; // Magic 42
  tiff.writeUInt32LE(8, pos); pos += 4; // Offset IFD0 = 8

  // IFD0: 5 tags
  // 1. Make (0x010F)
  // 2. Model (0x0110)
  // 3. Software (0x0131)
  // 4. ExifIFDPointer (0x8769)
  // 5. GPSInfoIFDPointer (0x8825)
  const ifd0Pos = pos;
  const ifd0Count = 5;
  tiff.writeUInt16LE(ifd0Count, pos); pos += 2;

  // Espaço para os 5 entries de 12 bytes cada = 60 bytes
  const ifd0EntriesPos = pos;
  pos += ifd0Count * 12;

  // Próximo IFD = 0
  tiff.writeUInt32LE(0, pos); pos += 4;

  // Área de dados para IFD0 strings
  const makeStr = "Sony Alpha OSINT\0";
  const makeOffset = pos;
  tiff.write(makeStr, pos); pos += makeStr.length;

  const modelStr = "ILCE-7RM4 (Cyber Lab)\0";
  const modelOffset = pos;
  tiff.write(modelStr, pos); pos += modelStr.length;

  const softwareStr = "RimuBusca Forensic v1.0\0";
  const softwareOffset = pos;
  tiff.write(softwareStr, pos); pos += softwareStr.length;

  // Agora vamos montar o GPS IFD
  // Tags GPS:
  // 0. GPSVersionID (0x0000): BYTE, count 4: 2 3 0 0
  // 1. GPSLatitudeRef (0x0001): ASCII, count 2: "S\0"
  // 2. GPSLatitude (0x0002): RATIONAL, count 3: 23/1, 33/1, 1872/1000
  // 3. GPSLongitudeRef (0x0003): ASCII, count 2: "W\0"
  // 4. GPSLongitude (0x0004): RATIONAL, count 3: 46/1, 37/1, 59908/1000
  // 5. GPSAltitudeRef (0x0005): BYTE, count 1: 0 (above sea level)
  // 6. GPSAltitude (0x0006): RATIONAL, count 1: 760/1
  const gpsIfdOffset = pos;
  const gpsCount = 7;
  tiff.writeUInt16LE(gpsCount, pos); pos += 2;
  const gpsEntriesPos = pos;
  pos += gpsCount * 12;
  tiff.writeUInt32LE(0, pos); pos += 4; // Next IFD

  // Área de dados para GPS
  const latRationalOffset = pos;
  // 23/1
  tiff.writeUInt32LE(23, pos); pos += 4;
  tiff.writeUInt32LE(1, pos); pos += 4;
  // 33/1
  tiff.writeUInt32LE(33, pos); pos += 4;
  tiff.writeUInt32LE(1, pos); pos += 4;
  // 1872/1000
  tiff.writeUInt32LE(1872, pos); pos += 4;
  tiff.writeUInt32LE(1000, pos); pos += 4;

  const lonRationalOffset = pos;
  // 46/1
  tiff.writeUInt32LE(46, pos); pos += 4;
  tiff.writeUInt32LE(1, pos); pos += 4;
  // 37/1
  tiff.writeUInt32LE(37, pos); pos += 4;
  tiff.writeUInt32LE(1, pos); pos += 4;
  // 59908/1000
  tiff.writeUInt32LE(59908, pos); pos += 4;
  tiff.writeUInt32LE(1000, pos); pos += 4;

  const altRationalOffset = pos;
  // 760/1
  tiff.writeUInt32LE(760, pos); pos += 4;
  tiff.writeUInt32LE(1, pos); pos += 4;

  // Agora vamos preencher os entries do GPS
  let ep = gpsEntriesPos;
  // 0. GPSVersionID
  tiff.writeUInt16LE(0x0000, ep); ep += 2;
  tiff.writeUInt16LE(1, ep); ep += 2; // BYTE
  tiff.writeUInt32LE(4, ep); ep += 4;
  tiff.writeUInt8(2, ep);
  tiff.writeUInt8(3, ep + 1);
  tiff.writeUInt8(0, ep + 2);
  tiff.writeUInt8(0, ep + 3);
  ep += 4;

  // 1. GPSLatitudeRef
  tiff.writeUInt16LE(0x0001, ep); ep += 2;
  tiff.writeUInt16LE(2, ep); ep += 2; // ASCII
  tiff.writeUInt32LE(2, ep); ep += 4;
  tiff.write('S\0\0\0', ep); ep += 4;

  // 2. GPSLatitude
  tiff.writeUInt16LE(0x0002, ep); ep += 2;
  tiff.writeUInt16LE(5, ep); ep += 2; // RATIONAL
  tiff.writeUInt32LE(3, ep); ep += 4;
  tiff.writeUInt32LE(latRationalOffset, ep); ep += 4;

  // 3. GPSLongitudeRef
  tiff.writeUInt16LE(0x0003, ep); ep += 2;
  tiff.writeUInt16LE(2, ep); ep += 2; // ASCII
  tiff.writeUInt32LE(2, ep); ep += 4;
  tiff.write('W\0\0\0', ep); ep += 4;

  // 4. GPSLongitude
  tiff.writeUInt16LE(0x0004, ep); ep += 2;
  tiff.writeUInt16LE(5, ep); ep += 2; // RATIONAL
  tiff.writeUInt32LE(3, ep); ep += 4;
  tiff.writeUInt32LE(lonRationalOffset, ep); ep += 4;

  // 5. GPSAltitudeRef
  tiff.writeUInt16LE(0x0005, ep); ep += 2;
  tiff.writeUInt16LE(1, ep); ep += 2; // BYTE
  tiff.writeUInt32LE(1, ep); ep += 4;
  tiff.writeUInt8(0, ep); ep += 4;

  // 6. GPSAltitude
  tiff.writeUInt16LE(0x0006, ep); ep += 2;
  tiff.writeUInt16LE(5, ep); ep += 2; // RATIONAL
  tiff.writeUInt32LE(1, ep); ep += 4;
  tiff.writeUInt32LE(altRationalOffset, ep); ep += 4;

  // Agora vamos montar o Exif SubIFD
  const exifSubIfdOffset = pos;
  const exifCount = 3;
  tiff.writeUInt16LE(exifCount, pos); pos += 2;
  const exifEntriesPos = pos;
  pos += exifCount * 12;
  tiff.writeUInt32LE(0, pos); pos += 4;

  const dateStr = "2026:10:22 14:32:00\0";
  const dateOffset = pos;
  tiff.write(dateStr, pos); pos += dateStr.length;

  let exp = exifEntriesPos;
  // 1. DateTimeOriginal (0x9003)
  tiff.writeUInt16LE(0x9003, exp); exp += 2;
  tiff.writeUInt16LE(2, exp); exp += 2; // ASCII
  tiff.writeUInt32LE(20, exp); exp += 4;
  tiff.writeUInt32LE(dateOffset, exp); exp += 4;

  // 2. FNumber (0x829D) = 2.8 (28/10)
  const fnumberOffset = pos;
  tiff.writeUInt32LE(28, pos); pos += 4;
  tiff.writeUInt32LE(10, pos); pos += 4;
  tiff.writeUInt16LE(0x829D, exp); exp += 2;
  tiff.writeUInt16LE(5, exp); exp += 2;
  tiff.writeUInt32LE(1, exp); exp += 4;
  tiff.writeUInt32LE(fnumberOffset, exp); exp += 4;

  // 3. ISOSpeedRatings (0x8827) = 400
  tiff.writeUInt16LE(0x8827, exp); exp += 2;
  tiff.writeUInt16LE(3, exp); exp += 2; // SHORT
  tiff.writeUInt32LE(1, exp); exp += 4;
  tiff.writeUInt16LE(400, exp); exp += 4;

  // Agora preenchemos IFD0 entries
  let ifd0p = ifd0EntriesPos;
  // 1. Make
  tiff.writeUInt16LE(0x010F, ifd0p); ifd0p += 2;
  tiff.writeUInt16LE(2, ifd0p); ifd0p += 2; // ASCII
  tiff.writeUInt32LE(makeStr.length, ifd0p); ifd0p += 4;
  tiff.writeUInt32LE(makeOffset, ifd0p); ifd0p += 4;

  // 2. Model
  tiff.writeUInt16LE(0x0110, ifd0p); ifd0p += 2;
  tiff.writeUInt16LE(2, ifd0p); ifd0p += 2;
  tiff.writeUInt32LE(modelStr.length, ifd0p); ifd0p += 4;
  tiff.writeUInt32LE(modelOffset, ifd0p); ifd0p += 4;

  // 3. Software
  tiff.writeUInt16LE(0x0131, ifd0p); ifd0p += 2;
  tiff.writeUInt16LE(2, ifd0p); ifd0p += 2;
  tiff.writeUInt32LE(softwareStr.length, ifd0p); ifd0p += 4;
  tiff.writeUInt32LE(softwareOffset, ifd0p); ifd0p += 4;

  // 4. ExifIFDPointer
  tiff.writeUInt16LE(0x8769, ifd0p); ifd0p += 2;
  tiff.writeUInt16LE(4, ifd0p); ifd0p += 2; // LONG
  tiff.writeUInt32LE(1, ifd0p); ifd0p += 4;
  tiff.writeUInt32LE(exifSubIfdOffset, ifd0p); ifd0p += 4;

  // 5. GPSInfoIFDPointer
  tiff.writeUInt16LE(0x8825, ifd0p); ifd0p += 2;
  tiff.writeUInt16LE(4, ifd0p); ifd0p += 2; // LONG
  tiff.writeUInt32LE(1, ifd0p); ifd0p += 4;
  tiff.writeUInt32LE(gpsIfdOffset, ifd0p); ifd0p += 4;

  const tiffData = tiff.slice(0, pos);

  // Agora montamos o arquivo JPEG:
  // SOI: FF D8
  // APP1: FF E1 + length(2) + "Exif\0\0"(6) + tiffData
  // DQT: Quantization table
  // SOF0: Baseline DCT 1x1
  // DHT: Huffman table
  // SOS: Start of Scan
  // Scan data + EOI (FF D9)
  const app1Length = 2 + 6 + tiffData.length;
  const app1Header = Buffer.from([
    0xFF, 0xE1,
    (app1Length >> 8) & 0xFF, app1Length & 0xFF,
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00 // "Exif\0\0"
  ]);

  // JPEG mínimo 1x1 pixel
  const jpegMinimal = Buffer.from([
    0xFF, 0xD8, // SOI
    ...app1Header,
    ...tiffData,
    // DQT
    0xFF, 0xDB, 0x00, 0x43, 0x00,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    // SOF0 (1x1 pixel)
    0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
    // DHT
    0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01,
    0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B,
    // SOS
    0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
    0x7F, 0x00, // compressed 1 pixel data
    0xFF, 0xD9  // EOI
  ]);

  const outputPath = path.join(samplesDir, 'amostra_forense_gps.jpg');
  fs.writeFileSync(outputPath, jpegMinimal);
  console.log(`✅ Imagem de demonstração com EXIF e GPS gerada em: ${outputPath} (${jpegMinimal.length} bytes)`);
}

createJpegWithGpsExif();

