import React from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Cell,
  ScatterChart, Scatter, ZAxis, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

// Table renderer for tabular data
const TableChart = ({ data }) => {
  if (!data?.headers || !data?.rows) return null;
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-slate-100">
            {data.headers.map((header, idx) => (
              <th key={idx} className="px-3 py-2 text-left font-semibold text-slate-700 border border-slate-200">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIdx) => (
            <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-3 py-2 text-slate-600 border border-slate-200">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Simple bar chart
const SimpleBarChart = ({ data }) => {
  if (!data?.labels || !data?.datasets) return null;
  
  const chartData = data.labels.map((label, idx) => ({
    name: label,
    ...data.datasets.reduce((acc, ds) => ({ ...acc, [ds.name]: ds.data[idx] }), {})
  }));
  
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        {data.datasets.length > 1 && <Legend />}
        {data.datasets.map((ds, idx) => (
          <Bar key={idx} dataKey={ds.name} fill={ds.color || '#3b82f6'} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

// Grouped/Combined bar chart
const CombinedBarChart = ({ data }) => {
  if (!data?.labels || !data?.datasets) return null;
  
  const chartData = data.labels.map((label, idx) => ({
    name: label,
    ...data.datasets.reduce((acc, ds) => ({ ...acc, [ds.name]: ds.data[idx] }), {})
  }));
  
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {data.datasets.map((ds, idx) => (
          <Bar key={idx} dataKey={ds.name} fill={ds.color} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

// Stacked bar chart
const StackedBarChart = ({ data }) => {
  if (!data?.labels || !data?.datasets) return null;
  
  const chartData = data.labels.map((label, idx) => ({
    name: label,
    ...data.datasets.reduce((acc, ds) => ({ ...acc, [ds.name]: ds.data[idx] }), {})
  }));
  
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {data.datasets.map((ds, idx) => (
          <Bar key={idx} dataKey={ds.name} fill={ds.color} stackId="stack" />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

// Line chart
const SimpleLineChart = ({ data }) => {
  if (!data?.labels || !data?.datasets) return null;
  
  const chartData = data.labels.map((label, idx) => ({
    name: label,
    ...data.datasets.reduce((acc, ds) => ({ ...acc, [ds.name]: ds.data[idx] }), {})
  }));
  
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        {data.datasets.length > 1 && <Legend />}
        {data.datasets.map((ds, idx) => (
          <Line 
            key={idx} 
            type="monotone" 
            dataKey={ds.name} 
            stroke={ds.color || '#3b82f6'} 
            strokeWidth={2}
            dot={{ fill: ds.color || '#3b82f6', r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

// Multi-line chart
const MultiLineChart = ({ data }) => {
  if (!data?.labels || !data?.datasets) return null;
  
  const chartData = data.labels.map((label, idx) => ({
    name: label,
    ...data.datasets.reduce((acc, ds) => ({ ...acc, [ds.name]: ds.data[idx] }), {})
  }));
  
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {data.datasets.map((ds, idx) => (
          <Line 
            key={idx} 
            type="monotone" 
            dataKey={ds.name} 
            stroke={ds.color} 
            strokeWidth={2}
            dot={{ fill: ds.color, r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

// Area chart
const SimpleAreaChart = ({ data }) => {
  if (!data?.labels || !data?.datasets) return null;
  
  const chartData = data.labels.map((label, idx) => ({
    name: label,
    ...data.datasets.reduce((acc, ds) => ({ ...acc, [ds.name]: ds.data[idx] }), {})
  }));
  
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {data.datasets.map((ds, idx) => (
          <Area 
            key={idx} 
            type="monotone" 
            dataKey={ds.name} 
            stroke={ds.color} 
            fill={ds.color}
            fillOpacity={0.3}
            stackId="1"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
};

// Combo chart (bar + line)
const ComboChart = ({ data }) => {
  if (!data?.labels || !data?.datasets) return null;
  
  const chartData = data.labels.map((label, idx) => ({
    name: label,
    ...data.datasets.reduce((acc, ds) => ({ ...acc, [ds.name]: ds.data[idx] }), {})
  }));
  
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {data.datasets.map((ds, idx) => (
          ds.type === 'line' ? (
            <Line 
              key={idx} 
              yAxisId="right"
              type="monotone" 
              dataKey={ds.name} 
              stroke={ds.color} 
              strokeWidth={2}
              dot={{ fill: ds.color, r: 4 }}
            />
          ) : (
            <Bar key={idx} yAxisId="left" dataKey={ds.name} fill={ds.color} />
          )
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
};

// Waterfall chart (simplified as bar with colors)
const WaterfallChart = ({ data }) => {
  if (!data?.categories || !data?.values) return null;
  
  const chartData = data.categories.map((cat, idx) => ({
    name: cat,
    value: data.values[idx],
    fill: data.colors?.[idx] || (data.values[idx] >= 0 ? '#10b981' : '#ef4444')
  }));
  
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 10, angle: -20 }} interval={0} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Bar dataKey="value">
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

// Custom tooltip for bubble chart
const BubbleTooltip = ({ active, payload, data }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    const sourceData = data.datasets.find(ds => ds.name === d.name);
    return (
      <div className="bg-white p-2 border rounded shadow text-xs">
        <p className="font-semibold">{d.name}</p>
        <p>{data.xLabel}: {sourceData?.x}</p>
        <p>{data.yLabel}: {sourceData?.y}%</p>
        <p>{data.zLabel}: {sourceData?.z}%</p>
      </div>
    );
  }
  return null;
};

// Bubble chart
const BubbleChart = ({ data }) => {
  if (!data?.datasets) return null;
  
  const chartData = data.datasets.map(ds => ({
    name: ds.name,
    x: ds.x,
    y: ds.y,
    z: ds.z * 10, // Scale for visibility
    fill: ds.color
  }));
  
  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="x" 
            type="number" 
            name={data.xLabel || 'X'} 
            tick={{ fontSize: 11 }}
            label={{ value: data.xLabel, position: 'bottom', fontSize: 11 }}
          />
          <YAxis 
            dataKey="y" 
            type="number" 
            name={data.yLabel || 'Y'} 
            tick={{ fontSize: 11 }}
            label={{ value: data.yLabel, angle: -90, position: 'left', fontSize: 11 }}
          />
          <ZAxis dataKey="z" range={[100, 500]} name={data.zLabel || 'Z'} />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            content={<BubbleTooltip data={data} />}
          />
          <Scatter data={chartData}>
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 justify-center text-xs">
        {data.datasets.map((ds, idx) => (
          <span key={idx} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ds.color }}></span>
            {ds.name}
          </span>
        ))}
      </div>
    </div>
  );
};

// Scatter plot
const ScatterPlot = ({ data }) => {
  if (!data?.points) return null;
  
  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="x" 
            type="number" 
            name={data.xLabel || 'X'} 
            tick={{ fontSize: 11 }}
            label={{ value: data.xLabel, position: 'bottom', fontSize: 11 }}
          />
          <YAxis 
            dataKey="y" 
            type="number" 
            name={data.yLabel || 'Y'} 
            tick={{ fontSize: 11 }}
            label={{ value: data.yLabel, angle: -90, position: 'left', fontSize: 11 }}
          />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={data.points} fill="#3b82f6" />
        </ScatterChart>
      </ResponsiveContainer>
      {data.trendline && (
        <p className="text-xs text-slate-500 text-center">
          Trend: y = {data.trendline.slope.toFixed(1)}x + {data.trendline.intercept}
        </p>
      )}
    </div>
  );
};

// Radar chart
const RadarChartComponent = ({ data }) => {
  if (!data?.labels || !data?.datasets) return null;
  
  const chartData = data.labels.map((label, idx) => ({
    subject: label,
    ...data.datasets.reduce((acc, ds) => ({ ...acc, [ds.name]: ds.data[idx] }), {}),
    fullMark: 100
  }));
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={chartData}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
        {data.datasets.map((ds, idx) => (
          <Radar
            key={idx}
            name={ds.name}
            dataKey={ds.name}
            stroke={ds.color}
            fill={ds.color}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 11 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
};

// Marimekko (simplified visualization)
const MarimekkoChart = ({ data }) => {
  if (!data?.regions) return null;
  
  return (
    <div className="space-y-2">
      <div className="flex h-48 border rounded overflow-hidden">
        {data.regions.map((region, rIdx) => (
          <div 
            key={rIdx} 
            className="flex flex-col border-r last:border-r-0"
            style={{ width: `${region.width}%` }}
          >
            {region.segments.map((seg, sIdx) => (
              <div
                key={sIdx}
                className={`flex items-center justify-center text-xs font-medium text-white ${
                  seg.name === 'Premium' ? 'bg-purple-500' :
                  seg.name === 'Standard' ? 'bg-blue-500' : 'bg-slate-400'
                }`}
                style={{ height: `${seg.height}%` }}
              >
                {seg.height >= 20 && `${seg.height}%`}
              </div>
            ))}
            <div className="text-xs text-center py-1 bg-slate-100 font-medium">
              {region.name} ({region.width}%)
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-4 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-purple-500 rounded"></span> Premium</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded"></span> Standard</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-slate-400 rounded"></span> Budget</span>
      </div>
    </div>
  );
};

// Heatmap (cohort analysis)
const HeatmapChart = ({ data }) => {
  if (!data?.rows || !data?.cols || !data?.values) return null;
  
  const getColor = (value) => {
    if (value >= 80) return 'bg-green-500 text-white';
    if (value >= 60) return 'bg-green-300 text-green-900';
    if (value >= 40) return 'bg-yellow-300 text-yellow-900';
    if (value >= 20) return 'bg-orange-300 text-orange-900';
    return 'bg-red-300 text-red-900';
  };
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="p-2 text-left"></th>
            {data.cols.map((col, idx) => (
              <th key={idx} className="p-2 text-center font-medium text-slate-600">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              <td className="p-2 font-medium text-slate-700 whitespace-nowrap">{row}</td>
              {data.values[rowIdx].map((val, colIdx) => (
                <td key={colIdx} className={`p-2 text-center font-medium ${getColor(val)}`}>
                  {val}%
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Treemap (simplified)
const TreemapChart = ({ data }) => {
  if (!data?.companies) return null;
  
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#94a3b8'];
  
  return (
    <div className="space-y-3">
      {data.companies.map((company, cIdx) => (
        <div key={cIdx} className="space-y-1">
          <p className="text-xs font-medium text-slate-700">{company.name}</p>
          <div className="flex gap-1 h-8">
            {company.subbrands.map((brand, bIdx) => (
              <div
                key={bIdx}
                className="flex items-center justify-center text-xs text-white font-medium rounded"
                style={{ 
                  width: `${brand.value * 3}%`, 
                  minWidth: '40px',
                  backgroundColor: colors[cIdx % colors.length] 
                }}
                title={`${brand.name}: ${brand.value}%`}
              >
                {brand.value}%
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Box plot (simplified)
const BoxPlotChart = ({ data }) => {
  if (!data?.categories || !data?.data) return null;
  
  return (
    <div className="space-y-3">
      {data.categories.map((cat, idx) => {
        const d = data.data[idx];
        const range = d.max - d.min;
        const scale = (val) => ((val - d.min) / range) * 100;
        
        return (
          <div key={idx} className="flex items-center gap-3">
            <span className="text-xs font-medium w-16 text-slate-600">{cat}</span>
            <div className="flex-1 relative h-6">
              {/* Whiskers */}
              <div 
                className="absolute h-0.5 bg-slate-400 top-1/2 -translate-y-1/2"
                style={{ left: '0%', width: '100%' }}
              />
              {/* Box */}
              <div 
                className="absolute h-full bg-blue-200 border border-blue-400 rounded"
                style={{ 
                  left: `${scale(d.q1)}%`, 
                  width: `${scale(d.q3) - scale(d.q1)}%` 
                }}
              />
              {/* Median */}
              <div 
                className="absolute w-0.5 h-full bg-blue-600"
                style={{ left: `${scale(d.median)}%` }}
              />
              {/* Min/Max markers */}
              <div className="absolute w-0.5 h-3 bg-slate-500 top-1/2 -translate-y-1/2" style={{ left: '0%' }} />
              <div className="absolute w-0.5 h-3 bg-slate-500 top-1/2 -translate-y-1/2" style={{ left: '100%' }} />
            </div>
            <span className="text-xs text-slate-500 w-20">${d.median}K median</span>
          </div>
        );
      })}
    </div>
  );
};

// Sankey diagram (simplified)
const SankeyChart = ({ data }) => {
  if (!data?.nodes || !data?.flows) return null;
  
  return (
    <div className="space-y-2">
      {data.nodes.map((node, idx) => {
        const flowIn = data.flows.filter(f => f.to === idx).reduce((sum, f) => sum + f.value, 0);
        const flowOut = data.flows.filter(f => f.from === idx).reduce((sum, f) => sum + f.value, 0);
        const value = idx === 0 ? parseInt(node.match(/\d+/)?.[0] || 0) * 1000 : Math.max(flowIn, flowOut);
        
        return (
          <div key={idx} className="flex items-center gap-2">
            <div 
              className="h-8 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-medium"
              style={{ width: `${Math.max(20, (value / 10000) * 100)}%` }}
            >
              {node}
            </div>
            {idx < data.nodes.length - 1 && (
              <span className="text-slate-400">→</span>
            )}
          </div>
        );
      })}
      <p className="text-xs text-slate-500 text-center mt-2">
        Funnel conversion: {((data.flows[data.flows.length - 1]?.value || 0) / 10000 * 100).toFixed(0)}%
      </p>
    </div>
  );
};

// Bubble matrix (simplified)
const BubbleMatrixChart = ({ data }) => {
  if (!data?.rows || !data?.cols || !data?.bubbles) return null;
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="p-2 text-xs"></th>
            {data.cols.map((col, idx) => (
              <th key={idx} className="p-2 text-xs font-medium text-slate-600 text-center">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              <td className="p-2 text-xs font-medium text-slate-700">{row}</td>
              {data.bubbles[rowIdx].map((bubble, colIdx) => (
                <td key={colIdx} className="p-2 text-center">
                  <div 
                    className={`inline-flex items-center justify-center rounded-full text-white text-xs font-medium ${
                      bubble.profit ? 'bg-green-500' : 'bg-red-400'
                    }`}
                    style={{ 
                      width: `${Math.max(24, bubble.size)}px`, 
                      height: `${Math.max(24, bubble.size)}px` 
                    }}
                  >
                    {bubble.size}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-center gap-4 text-xs mt-2">
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-full"></span> Profitable</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded-full"></span> Unprofitable</span>
      </div>
    </div>
  );
};

// Dashboard (multi-panel)
const DashboardChart = ({ data }) => {
  if (!data?.panels) return null;
  
  return (
    <div className="grid grid-cols-2 gap-3">
      {data.panels.map((panel, idx) => {
        const panelData = Object.entries(panel.data).map(([key, value]) => ({ name: key, value }));
        
        return (
          <div key={idx} className="border rounded p-2 bg-slate-50">
            <p className="text-xs font-medium text-slate-700 mb-2">{panel.title}</p>
            {panel.type === 'bar' ? (
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={panelData}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : panel.type === 'line' ? (
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={panelData}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : panel.type === 'area' ? (
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={panelData}>
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Area type="monotone" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-20 flex items-center justify-center">
                <div className="text-2xl font-bold text-blue-600">
                  {panelData[panelData.length - 1]?.value}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Main chart renderer component
const DrillChartRenderer = ({ chartType, chartData }) => {
  if (!chartType || !chartData) return null;
  
  const chartComponents = {
    table: TableChart,
    bar: SimpleBarChart,
    combined_bar: CombinedBarChart,
    stacked_bar: StackedBarChart,
    line: SimpleLineChart,
    multi_line: MultiLineChart,
    area: SimpleAreaChart,
    combo: ComboChart,
    waterfall: WaterfallChart,
    bubble: BubbleChart,
    scatter: ScatterPlot,
    radar: RadarChartComponent,
    marimekko: MarimekkoChart,
    heatmap: HeatmapChart,
    treemap: TreemapChart,
    boxplot: BoxPlotChart,
    sankey: SankeyChart,
    bubble_matrix: BubbleMatrixChart,
    dashboard: DashboardChart
  };
  
  const ChartComponent = chartComponents[chartType];
  
  if (!ChartComponent) {
    return (
      <div className="p-4 bg-slate-100 rounded text-sm text-slate-500 text-center">
        Chart type &quot;{chartType}&quot; not supported
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4">
      <ChartComponent data={chartData} />
    </div>
  );
};

export default DrillChartRenderer;
