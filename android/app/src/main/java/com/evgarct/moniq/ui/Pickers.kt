package com.evgarct.moniq.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.evgarct.moniq.data.Category
import com.evgarct.moniq.data.Snapshot
import com.evgarct.moniq.domain.DayCount
import com.evgarct.moniq.domain.categoryGroups
import com.evgarct.moniq.domain.categoryPath
import com.evgarct.moniq.domain.recentCategories
import com.evgarct.moniq.domain.selectableCategories
import java.time.LocalDate

data class PickerOption(val key: String, val title: String, val detail: String? = null, val icon: String? = null)

/** A short list of choices in a sheet: wallets, goals, repeat cadence. */
@Composable
fun PickerSheet(
    open: Boolean,
    title: String,
    options: List<PickerOption>,
    selected: String?,
    onDismiss: () -> Unit,
    onPick: (String) -> Unit,
) {
    val palette = LocalPalette.current
    Sheet(open = open, onDismiss = onDismiss, scrim = .35f) {
        Column(Modifier.padding(start = 24.dp, end = 24.dp, bottom = 16.dp)) {
            SheetHeader(title, onClose = onDismiss)
            LazyColumn(Modifier.fillMaxWidth().heightIn(max = 440.dp)) {
                items(options, key = { it.key }) { option ->
                    Row(
                        Modifier.fillMaxWidth().height(54.dp).tap(scale = .98f, haptic = true) { onPick(option.key) },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (option.icon != null) PathIcon(option.icon, Modifier.padding(end = 14.dp))
                        T(option.title, sans(17, if (option.key == selected) 600 else 500), Modifier.weight(1f).padding(end = 12.dp), maxLines = 1)
                        if (option.detail != null) T(option.detail, sans(14), Modifier.padding(end = 12.dp), palette.mute, maxLines = 1)
                        Box(Modifier.size(8.dp).graphicsLayer { alpha = if (option.key == selected) 1f else 0f }.background(palette.terra, CircleShape))
                    }
                }
            }
        }
    }
}

@Composable
fun DateSheet(
    open: Boolean,
    title: String,
    selected: LocalDate?,
    counts: Map<String, DayCount>,
    onDismiss: () -> Unit,
    clearLabel: String? = null,
    onClear: () -> Unit = {},
    onPick: (LocalDate) -> Unit,
) {
    val today = remember { LocalDate.now() }
    Sheet(open = open, onDismiss = onDismiss, scrim = .35f) {
        Column(Modifier.padding(start = 24.dp, end = 24.dp, bottom = 20.dp)) {
            SheetHeader(title, onClose = onDismiss)
            MonthCalendar(selected = selected, today = today, counts = counts, onPick = onPick)
            if (clearLabel != null) {
                Box(Modifier.fillMaxWidth().height(52.dp).tap(scale = .98f, onClick = onClear), contentAlignment = Alignment.CenterStart) {
                    T(clearLabel, sans(16, 500), color = LocalPalette.current.terraInk)
                }
            }
        }
    }
}

@Composable
fun PlainField(
    value: String,
    onChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    style: TextStyle = sans(16),
    imeAction: ImeAction = ImeAction.Done,
    onFocus: (Boolean) -> Unit = {},
) {
    val palette = LocalPalette.current
    BasicTextField(
        value = value,
        onValueChange = onChange,
        modifier = modifier.onFocusChanged { onFocus(it.isFocused) },
        singleLine = true,
        textStyle = style.merge(TextStyle(color = palette.ink)),
        cursorBrush = SolidColor(palette.terra),
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = imeAction),
        decorationBox = { inner ->
            Box(contentAlignment = Alignment.CenterStart) {
                if (value.isEmpty()) T(placeholder, style, color = palette.mute.copy(alpha = .8f), maxLines = 1)
                inner()
            }
        },
    )
}

/** All categories: search, the recent few, then every top-level group as an accordion. */
@Composable
fun CategorySheet(
    open: Boolean,
    snapshot: Snapshot,
    type: String,
    selected: String?,
    onDismiss: () -> Unit,
    onPick: (Category) -> Unit,
) {
    val palette = LocalPalette.current
    var query by remember(open) { mutableStateOf("") }
    var expanded by remember(open) { mutableStateOf<String?>(null) }
    val leaves = remember(snapshot, type) { snapshot.selectableCategories(type) }
    val recent = remember(snapshot, type) { snapshot.recentCategories(type, 6) }
    val groups = remember(snapshot, type) { snapshot.categoryGroups(type) }
    val q = query.trim().lowercase()
    val results = if (q.isEmpty()) recent else leaves.filter { snapshot.categoryPath(it).lowercase().contains(q) }.sortedBy { it.name.lowercase() }

    Sheet(open = open, onDismiss = onDismiss, scrim = .35f, heightFraction = .83f) {
        Column(Modifier.fillMaxSize().imePadding().padding(horizontal = 24.dp)) {
            SheetHeader("Category", onClose = onDismiss)
            Box(Modifier.fillMaxWidth().height(52.dp).background(palette.panel, RoundedCornerShape(26.dp)).padding(horizontal = 20.dp), contentAlignment = Alignment.CenterStart) {
                PlainField(query, { query = it }, "Search all categories", Modifier.fillMaxWidth(), imeAction = ImeAction.Search)
            }
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(top = 24.dp, bottom = 28.dp)) {
                item(key = "list-title") { Label(if (q.isEmpty()) "Recent" else "Results", Modifier.padding(bottom = 6.dp)) }
                items(results, key = { "r-${it.id}" }) { leaf ->
                    LeafRow(leaf.icon, if (q.isEmpty()) leaf.name else snapshot.categoryPath(leaf), leaf.id == selected, Modifier.animateItem()) { onPick(leaf) }
                }
                if (results.isEmpty()) {
                    item(key = "none") { T("No category matches.", serif(20), Modifier.padding(top = 8.dp), palette.mute) }
                }
                if (q.isEmpty() && groups.isNotEmpty()) {
                    item(key = "all-title") { Label("All categories", Modifier.padding(top = 28.dp, bottom = 6.dp)) }
                    groups.forEach { group ->
                        val key = group.parent?.id ?: "standalone"
                        val isOpen = expanded == key
                        item(key = "g-$key") {
                            Column {
                                Row(
                                    Modifier.fillMaxWidth().height(52.dp).tap(scale = .98f) { expanded = if (isOpen) null else key },
                                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween,
                                ) {
                                    T(group.parent?.name ?: "Other", serif(22), Modifier.weight(1f), if (isOpen) palette.ink else palette.mute, maxLines = 1)
                                    val turn by animateFloatAsState(if (isOpen) 180f else 0f, tween(350, easing = Motion.Out), label = "chevron")
                                    PathIcon(Glyph.CHEVRON_DOWN, Modifier.graphicsLayer { rotationZ = turn }, size = 18.dp, viewport = 18f, stroke = 1.6.dp)
                                }
                                AnimatedVisibility(
                                    isOpen,
                                    enter = expandVertically(tween(450, easing = Motion.Sheet)) + fadeIn(tween(300)),
                                    exit = shrinkVertically(tween(350, easing = Motion.Sheet)) + fadeOut(tween(200)),
                                ) {
                                    Column { group.leaves.forEach { leaf -> LeafRow(leaf.icon, leaf.name, leaf.id == selected) { onPick(leaf) } } }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LeafRow(icon: String?, label: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Row(modifier.fillMaxWidth().height(50.dp).tap(scale = .98f, haptic = true, onClick = onClick), verticalAlignment = Alignment.CenterVertically) {
        CategoryGlyph(icon)
        T(label, sans(17, 500), Modifier.weight(1f).padding(start = 14.dp, end = 12.dp), maxLines = 1)
        Box(Modifier.size(8.dp).graphicsLayer { alpha = if (selected) 1f else 0f }.background(LocalPalette.current.terra, CircleShape))
    }
}
