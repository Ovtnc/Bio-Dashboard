declare module "plotly.js-dist-min" {
  type ToImageOptions = {
    format?: "png" | "jpeg" | "webp" | "svg";
    width?: number;
    height?: number;
    scale?: number;
  };

  const Plotly: {
    toImage: (graphDiv: unknown, options?: ToImageOptions) => Promise<string>;
  };

  export default Plotly;
}
