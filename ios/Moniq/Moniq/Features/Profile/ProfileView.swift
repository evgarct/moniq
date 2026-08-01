import SwiftUI

struct ProfileView: View {
    let userID: UUID
    let onSignOut: () async -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("profile.title")
                    .font(.system(.largeTitle, design: .serif, weight: .semibold))

                MoniqGlassSurface {
                    VStack(spacing: 0) {
                        NavigationLink {
                            FeaturePlaceholderView(title: "profile.inbox", systemImage: "tray")
                        } label: {
                            ProfileRow(title: "profile.inbox", systemImage: "tray")
                        }
                        Divider().padding(.leading, 52)
                        NavigationLink {
                            SettingsView(userID: userID)
                        } label: {
                            ProfileRow(title: "profile.settings", systemImage: "gearshape")
                        }
                    }
                    .padding(.vertical, 4)
                }

                Button(role: .destructive) {
                    Task { await onSignOut() }
                } label: {
                    Label("profile.signOut", systemImage: "rectangle.portrait.and.arrow.right")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.glass)
                .controlSize(.large)
                .accessibilityIdentifier("profile.signOut")
            }
            .padding(24)
        }
        .navigationBarTitleDisplayMode(.inline)
        .moniqCanvas()
    }
}

private struct ProfileRow: View {
    let title: LocalizedStringKey
    let systemImage: String

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: systemImage)
                .font(.system(size: 18, weight: .thin))
                .frame(width: 24)
            Text(title)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(MoniqColor.muted)
        }
        .padding(.horizontal, 18)
        .frame(minHeight: 56)
        .contentShape(.rect)
    }
}
