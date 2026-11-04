// Tokens from DESIGN.md, shared with the web admin (frontend/src/index.css). Change both together.
export const colors = {
  surface: '#ffffff',
  text: '#202020',
  muted: '#646464',
  border: '#e5e5e5',
  controlBorder: '#b8b8b8',
  hover: '#f5f5f5',
  frame: '#f3f6f8',
  primary: '#12263a',
  primaryPressed: '#213d58',
  danger: '#b42318',
  focus: '#245bba',
  data: '#007c92',
  rule: '#eef1f3',
} as const

// Each IBM Plex Sans weight loads as its own family, so set fontFamily rather than fontWeight.
export const fonts = {
  regular: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
} as const

export const type = {
  title: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28 },
  section: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  // 16px input text keeps iOS from zooming and reads comfortably at arm's length.
  input: { fontFamily: fonts.regular, fontSize: 16 },
} as const

/** Minimum height and width of anything tappable. */
export const touchTarget = 44
/** Screen side padding. */
export const gutter = 16

export const radius = {
  control: 6,
  emptyState: 8,
} as const
