"use client";
import * as React from "react";

export function useMobile() {
  const [mobile, setMobile] = React.useState(false);

  React.useEffect(() => {
    const update = () => setMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return mobile;
}
