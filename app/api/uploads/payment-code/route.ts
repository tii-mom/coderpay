export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

const MAX_FILE_SIZE = 1024 * 1024;
const MAX_PIXELS = 16_000_000;
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
  "image/gif": "GIF"
};

function readUint16BE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) + bytes[offset + 1];
}

function readUint32BE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] * 2 ** 24) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function getImageDimensions(bytes: Uint8Array, type: string) {
  if (type === "image/png" && bytes.length >= 24) {
    return { width: readUint32BE(bytes, 16), height: readUint32BE(bytes, 20) };
  }

  if (type === "image/gif" && bytes.length >= 10) {
    return {
      width: bytes[6] + (bytes[7] << 8),
      height: bytes[8] + (bytes[9] << 8)
    };
  }

  if (type === "image/webp" && bytes.length >= 30 && String.fromCharCode(...bytes.slice(12, 16)) === "VP8X") {
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)
    };
  }

  if (type === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const length = readUint16BE(bytes, offset + 2);
      if (length < 2) break;
      if (marker >= 0xc0 && marker <= 0xc3) {
        return {
          height: readUint16BE(bytes, offset + 5),
          width: readUint16BE(bytes, offset + 7)
        };
      }
      offset += 2 + length;
    }
  }

  return null;
}

function hasExpectedMagic(bytes: Uint8Array, type: string) {
  if (type === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/gif") return String.fromCharCode(...bytes.slice(0, 3)) === "GIF";
  if (type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "请上传收款码图片文件" }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "图片文件不能为空" }, { status: 400 });
    }

    if (!ALLOWED_TYPES[file.type]) {
      return NextResponse.json({ error: "仅支持 PNG、JPG、WEBP、GIF 图片" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "图片不能超过 1MB" }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasExpectedMagic(bytes, file.type)) {
      return NextResponse.json({ error: "图片内容与文件类型不匹配" }, { status: 400 });
    }

    const dimensions = getImageDimensions(bytes, file.type);
    if (dimensions && dimensions.width * dimensions.height > MAX_PIXELS) {
      return NextResponse.json({ error: "图片尺寸过大，请上传较小的收款码图片" }, { status: 400 });
    }

    const base64 = bytesToBase64(bytes);

    return NextResponse.json({
      url: `data:${file.type};base64,${base64}`,
      fileType: ALLOWED_TYPES[file.type]
    });
  } catch (err) {
    console.error("Payment code upload failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
