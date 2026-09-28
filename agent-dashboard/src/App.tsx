// GORKA Agent Dashboard
//
// Phase 9.5 scaffold. This is a placeholder screen.
//
// The real Agent UI (the three-step entry flow, the debtor profile,
// the plan view, the Communication Tools screen) is Phase 9.5
// implementation work. It does not exist yet. This file exists only
// to prove the second Tauri binary can load its own frontend.

function App() {
  return (
    <div
      style={{
        fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        margin: 0,
        background: '#f9fafb',
        color: '#111827',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          maxWidth: 480,
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 'bold', margin: 0 }}>
          GORKA Agent
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 12 }}>
          Scaffold verified. The Agent App is the second Tauri binary in
          the GORKA repository. The full UI is Phase 9.5 implementation
          work, not part of this scaffold.
        </p>
      </div>
    </div>
  )
}

export default App