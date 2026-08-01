import SwiftUI

/// Shared skeleton placeholder for tabs that don't have real content yet.
/// No cards/chips — a flat centered layout, consistent with docs/design.md.
struct FeaturePlaceholderView: View {
    let title: LocalizedStringKey
    let systemImage: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 32, weight: .thin))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.title2.weight(.semibold))
            Text("feature.placeholder")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(MoniqColor.background)
    }
}
