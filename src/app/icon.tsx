import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "radial-gradient(circle at top right, rgba(255,184,61,0.65), rgba(18,26,38,1) 40%), linear-gradient(180deg, #101722 0%, #182231 100%)",
          color: "white",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 210,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: -12,
          }}
        >
          P
        </div>
        <div
          style={{
            fontSize: 44,
            textTransform: "uppercase",
            letterSpacing: 16,
            color: "#ffb83d",
          }}
        >
          ParkFlow
        </div>
      </div>
    ),
    size,
  );
}
