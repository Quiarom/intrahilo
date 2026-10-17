export const isRealRadarEmpty = (synthetic: boolean, radar: { windows: { current: { total: number } } } | null) => !synthetic && radar?.windows.current.total === 0;
