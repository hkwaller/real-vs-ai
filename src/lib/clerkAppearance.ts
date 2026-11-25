// Split duel styling for every Clerk component (sign-in, sign-up, user menu,
// modals): square, flat, Archivo; orange primary with ink text; links in blue
// because orange text on white fails contrast at small sizes.
export const clerkAppearance = {
  variables: {
    colorPrimary: '#ff5a1f',
    colorPrimaryForeground: '#0e0e0e',
    colorForeground: '#0e0e0e',
    colorMutedForeground: '#4a4a4a',
    colorBackground: '#ffffff',
    colorInput: '#ffffff',
    colorInputForeground: '#0e0e0e',
    colorBorder: '#0e0e0e',
    colorDanger: '#0e0e0e',
    colorShadow: 'transparent',
    borderRadius: '0px',
    fontFamily: "'Archivo', Arial, sans-serif",
  },
  elements: {
    cardBox: { borderRadius: 0, boxShadow: 'none', border: '4px solid #0e0e0e' },
    card: { borderRadius: 0, boxShadow: 'none' },
    formButtonPrimary: {
      backgroundColor: '#ff5a1f',
      color: '#0e0e0e',
      borderRadius: 0,
      boxShadow: 'none',
      fontWeight: 900,
      textTransform: 'uppercase' as const,
    },
    formFieldInput: { borderRadius: 0, border: '2px solid #0e0e0e', boxShadow: 'none' },
    footerActionLink: { color: '#1238ff', fontWeight: 700 },
    formResendCodeLink: { color: '#1238ff' },
    identityPreviewEditButton: { color: '#1238ff' },
    formFieldAction: { color: '#1238ff' },
    userButtonPopoverCard: { borderRadius: 0, boxShadow: 'none', border: '4px solid #0e0e0e' },
  },
}
