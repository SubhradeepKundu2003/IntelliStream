export const COLORS = {
  'tcs-black':      '#000000',
  'tcs-white':      '#ffffff',
  'tcs-blue':       '#4e84c4',
  'tcs-blue-light': '#6fa0d4',
  'tcs-blue-dark':  '#3a6ba8',
  'tcs-gray-50':    '#fafafa',
  'tcs-gray-100':   '#f5f5f5',
  'tcs-gray-200':   '#e5e5e5',
  'tcs-gray-300':   '#d4d4d4',
  'tcs-gray-400':   '#a3a3a3',
  'tcs-gray-500':   '#737373',
  'tcs-gray-600':   '#525252',
  'tcs-gray-700':   '#404040',
  'tcs-gray-800':   '#262626',
  'tcs-gray-900':   '#171717',
} as const;

export type ColorKey = keyof typeof COLORS;
