import { useEffect, useRef } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

interface Props {
  title: string
  /** Unix seconds — uPlot's native x scale. */
  timestamps: number[]
  series: { label: string; values: (number | null)[]; color: string }[]
  /** Fix the y axis, e.g. [0, 100] for percentages. */
  range?: [number, number]
  unit?: string
}

/**
 * uPlot rather than a React charting library: it draws to canvas, so a 5-second
 * tick costs a redraw instead of a virtual-DOM diff over 180 points × N series.
 * It is also ~45 KB against ~500 KB for recharts with its d3 dependencies.
 */
export function MetricChart({ title, timestamps, series, range, unit }: Props): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const plotRef = useRef<uPlot | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const options: uPlot.Options = {
      width: host.clientWidth,
      height: 130,
      title,
      cursor: { show: true },
      legend: { show: series.length > 1 },
      scales: { y: range ? { range } : {} },
      axes: [
        {
          stroke: '#787c99',
          grid: { stroke: 'rgba(47,51,77,0.5)' },
          ticks: { stroke: 'rgba(47,51,77,0.5)' },
        },
        {
          stroke: '#787c99',
          grid: { stroke: 'rgba(47,51,77,0.5)' },
          ticks: { stroke: 'rgba(47,51,77,0.5)' },
          values: (_u, ticks) => ticks.map((v) => `${String(Math.round(v))}${unit ?? ''}`),
        },
      ],
      series: [
        {},
        ...series.map((s) => ({
          label: s.label,
          stroke: s.color,
          width: 1.5,
          fill: `${s.color}22`,
          // Gaps are real: a failed collection round has no value, and drawing
          // through it would invent data that never existed.
          spanGaps: false,
        })),
      ],
    }

    const plot = new uPlot(options, [timestamps, ...series.map((s) => s.values)], host)
    plotRef.current = plot

    const observer = new ResizeObserver(() => {
      plot.setSize({ width: host.clientWidth, height: 130 })
    })
    observer.observe(host)

    return () => {
      observer.disconnect()
      plot.destroy()
      plotRef.current = null
    }
    // Recreating on data change would reset the cursor and flash; data updates
    // go through the effect below via setData instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, series.length, unit])

  useEffect(() => {
    plotRef.current?.setData([timestamps, ...series.map((s) => s.values)])
  }, [timestamps, series])

  return <div ref={hostRef} className="chart" />
}
