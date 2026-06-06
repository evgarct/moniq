import { ImageResponse } from "next/og";

export const alt = "Moniq personal finance workspace";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#fafaf7",
          color: "#191919",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div style={{ alignItems: "center", display: "flex", gap: 44 }}>
          <div
            style={{
              alignItems: "center",
              background: "#191919",
              borderRadius: 56,
              display: "flex",
              height: 216,
              justifyContent: "center",
              position: "relative",
              width: 216,
            }}
          >
            <div
              style={{
                border: "14px solid #fafaf7",
                borderTop: "none",
                borderRadius: "0 0 72px 72px",
                height: 96,
                position: "absolute",
                top: 72,
                width: 104,
              }}
            />
            <div
              style={{
                background: "#fafaf7",
                borderRadius: 8,
                height: 14,
                position: "absolute",
                top: 66,
                width: 124,
              }}
            />
            <div
              style={{
                background: "#cc785c",
                borderRadius: 18,
                height: 36,
                position: "absolute",
                top: 55,
                width: 36,
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "serif", fontSize: 112, letterSpacing: -6 }}>Moniq</div>
            <div style={{ color: "#666663", fontSize: 32 }}>
              Personal finance, calmly organized.
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
