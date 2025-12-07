import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { readFile, stat } from "fs/promises";
import { cwd } from "process";
import { existsSync } from "fs";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ path: string[] }> }
) {
  try {
    const params = await props.params;
    const pathSegments = params.path;
    const filename = pathSegments.join("/");
    
    // Security check: prevent directory traversal
    if (filename.includes("..")) {
      return new NextResponse("Invalid path", { status: 400 });
    }

    // Construct correct absolute path
    // In production, process.cwd() is the root of the project
    const filePath = join(cwd(), "public", "uploads", filename);

    if (!existsSync(filePath)) {
      return new NextResponse("File not found", { status: 404 });
    }

    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return new NextResponse("Not a file", { status: 400 });
    }

    const fileBuffer = await readFile(filePath);

    // Determine content type
    let contentType = "application/octet-stream";
    const ext = filename.split(".").pop()?.toLowerCase();
    
    switch (ext) {
      case "png":
        contentType = "image/png";
        break;
      case "jpg":
      case "jpeg":
        contentType = "image/jpeg";
        break;
      case "gif":
        contentType = "image/gif";
        break;
      case "webp":
        contentType = "image/webp";
        break;
      case "svg":
        contentType = "image/svg+xml";
        break;
      case "pdf":
        contentType = "application/pdf";
        break;
      case "txt":
        contentType = "text/plain";
        break;
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
