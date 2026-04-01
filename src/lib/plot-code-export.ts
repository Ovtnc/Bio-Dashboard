export type PlotExportDataset = {
  name: string;
  x: Array<string | number>;
  y: number[];
  type?: "scatter" | "bar";
  mode?: "lines" | "markers" | "lines+markers" | "text+markers";
  color?: string;
};

export type PlotExportSpec = {
  title: string;
  xLabel: string;
  yLabel: string;
  datasets: PlotExportDataset[];
};

function quotePy(value: string) {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function toPythonArray(values: Array<string | number>) {
  const rendered = values.map((value) =>
    typeof value === "number" && Number.isFinite(value) ? String(value) : quotePy(String(value))
  );
  return `[${rendered.join(", ")}]`;
}

function quoteR(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function toRArray(values: Array<string | number>) {
  const rendered = values.map((value) =>
    typeof value === "number" && Number.isFinite(value) ? String(value) : quoteR(String(value))
  );
  return `c(${rendered.join(", ")})`;
}

export function buildPythonPlotCode(spec: PlotExportSpec) {
  const lines: string[] = [
    "import plotly.graph_objects as go",
    "",
    "fig = go.Figure()",
    "",
  ];

  for (const dataset of spec.datasets) {
    const traceType = dataset.type === "bar" ? "Bar" : "Scatter";
    const modeSegment =
      traceType === "Scatter"
        ? `, mode=${quotePy(dataset.mode ?? "markers")}`
        : "";
    const colorSegment = dataset.color
      ? `, marker=dict(color=${quotePy(dataset.color)})`
      : "";

    lines.push(
      `fig.add_trace(go.${traceType}(` +
        `x=${toPythonArray(dataset.x)}, ` +
        `y=${toPythonArray(dataset.y)}, ` +
        `name=${quotePy(dataset.name)}` +
        `${modeSegment}${colorSegment}` +
      `))`
    );
  }

  lines.push(
    "",
    "fig.update_layout(",
    `    title=${quotePy(spec.title)},`,
    `    xaxis_title=${quotePy(spec.xLabel)},`,
    `    yaxis_title=${quotePy(spec.yLabel)},`,
    "    template='plotly_white',",
    ")",
    "",
    "fig.show()"
  );

  return lines.join("\n");
}

export function buildRPlotCode(spec: PlotExportSpec) {
  const frameBlocks: string[] = [];
  for (const dataset of spec.datasets) {
    frameBlocks.push(
      `data.frame(` +
        `series=${quoteR(dataset.name)}, ` +
        `x=${toRArray(dataset.x)}, ` +
        `y=${toRArray(dataset.y)}` +
      `)`
    );
  }

  const isBar = spec.datasets.every((dataset) => dataset.type === "bar");

  const lines: string[] = [
    "library(ggplot2)",
    "",
    `df <- do.call(rbind, list(${frameBlocks.join(", ")}))`,
    "",
    "p <- ggplot(df, aes(x = x, y = y, color = series, fill = series)) +",
    isBar ? "  geom_col(position = \"dodge\") +" : "  geom_line(linewidth = 1) + geom_point(size = 2) +",
    `  labs(title = ${quoteR(spec.title)}, x = ${quoteR(spec.xLabel)}, y = ${quoteR(spec.yLabel)}) +`,
    "  theme_minimal(base_size = 12)",
    "",
    "print(p)",
  ];

  return lines.join("\n");
}
