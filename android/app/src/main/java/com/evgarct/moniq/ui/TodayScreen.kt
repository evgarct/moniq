package com.evgarct.moniq.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.evgarct.moniq.R
import com.evgarct.moniq.data.Snapshot
import com.evgarct.moniq.data.Tx
import com.evgarct.moniq.domain.DayCount
import com.evgarct.moniq.domain.dayCounts
import com.evgarct.moniq.domain.dayItems
import com.evgarct.moniq.domain.formatAmount
import com.evgarct.moniq.domain.headerLabel
import com.evgarct.moniq.domain.iso
import com.evgarct.moniq.domain.longLabel
import com.evgarct.moniq.domain.monthYear
import com.evgarct.moniq.domain.shortLabel
import com.evgarct.moniq.domain.txCurrency
import com.evgarct.moniq.domain.txIcon
import com.evgarct.moniq.domain.txMeta
import com.evgarct.moniq.domain.txTitle
import com.evgarct.moniq.domain.weekdayShort
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle as JavaTextStyle
import java.util.Locale

@Composable
fun BrandMark(modifier: Modifier = Modifier, height: Dp = 26.dp) {
    val dark = LocalPalette.current.dark
    Image(painterResource(if (dark) R.drawable.logo_mark_dark else R.drawable.logo_mark), contentDescription = "Moniq", modifier = modifier.height(height))
}

@Composable
fun IconButton(path: String, label: String, modifier: Modifier = Modifier, viewport: Float = 24f, onClick: () -> Unit) {
    Box(modifier.size(44.dp).tap(label = label, onClick = onClick), contentAlignment = Alignment.Center) {
        PathIcon(path, size = 24.dp, viewport = viewport, stroke = 1.6.dp, color = LocalPalette.current.ink)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TodayScreen(state: AppState, snapshot: Snapshot, refreshing: Boolean, email: String) {
    val palette = LocalPalette.current
    val today = remember(snapshot) { LocalDate.now() }
    val counts = remember(snapshot) { snapshot.dayCounts(today) }
    val days = remember(state.windowStart) { (0..3L).map { state.windowStart.plusDays(it) } }
    val items = remember(snapshot, state.selectedDate) { snapshot.dayItems(state.selectedDate, today) }
    val pull = rememberPullToRefreshState()
    val scope = rememberCoroutineScope()

    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = { scope.launch { state.repo.refresh() } },
        state = pull,
        modifier = Modifier.fillMaxSize(),
        indicator = {
            val reach = if (refreshing) 1f else pull.distanceFraction.coerceIn(0f, 1f)
            Box(Modifier.align(Alignment.TopCenter).windowInsetsPadding(WindowInsets.statusBars).padding(top = 8.dp).graphicsLayer {
                alpha = reach
                scaleX = .4f + reach * .6f
                scaleY = .4f + reach * .6f
                translationY = reach * 16.dp.toPx()
            }) {
                if (refreshing) BreathingDot(12.dp, palette.terra) else Box(Modifier.size(12.dp).background(palette.terra, CircleShape))
            }
        },
    ) {
        // Brand rings: three hairline circles bleeding off the top-right corner.
        Canvas(Modifier.align(Alignment.TopEnd).offset(x = 120.dp, y = (-150).dp).size(300.dp).rise(durationMs = 1600, distance = 0)) {
            listOf(149f, 118f, 87f).forEach { drawCircle(palette.line, radius = it.dp.toPx(), style = Stroke(1.dp.toPx())) }
        }
        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = 24.dp, end = 24.dp, bottom = 150.dp),
        ) {
            item(key = "top") {
                Column {
                    StatusBarSpacer()
                    Row(Modifier.fillMaxWidth().padding(top = 20.dp).height(44.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                        BrandMark()
                        Row(Modifier.offset(x = 10.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            IconButton(Glyph.CALENDAR, if (state.calendarOpen) "Hide month" else "Show month") { state.calendarOpen = !state.calendarOpen }
                            Box(Modifier.size(44.dp).tap(label = "Profile and settings") { state.settingsOpen = true }, contentAlignment = Alignment.Center) {
                                Box(Modifier.size(30.dp).background(palette.stone, CircleShape), contentAlignment = Alignment.Center) {
                                    T(email.take(1).uppercase().ifEmpty { "M" }, serif(17, italic = true), maxLines = 1)
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(36.dp))
                    Column(Modifier.rise(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Label(today.headerLabel())
                        Column {
                            T("Today", serif(38, lineHeight = 1.04f, tracking = -.02f))
                            T("and the next 3 days.", serif(38, italic = true, lineHeight = 1.04f, tracking = -.02f), color = palette.terra, maxLines = 1)
                        }
                    }
                    AnimatedVisibility(
                        visible = state.calendarOpen,
                        enter = expandVertically(tween(600, easing = Motion.Sheet)) + fadeIn(tween(400)),
                        exit = shrinkVertically(tween(600, easing = Motion.Sheet)) + fadeOut(tween(300)),
                    ) {
                        MonthCalendar(
                            selected = state.selectedDate, today = today, counts = counts,
                            modifier = Modifier.padding(top = 30.dp), onPick = state::pickDate,
                        )
                    }
                }
            }

            item(key = "strip") {
                DayStrip(
                    days = days, selected = state.selectedDate, today = today, counts = counts,
                    modifier = Modifier.padding(top = 64.dp).rise(200), onPick = state::pickDate,
                    onShift = { direction ->
                        val start = state.windowStart.plusDays(direction * 4L)
                        state.windowStart = start
                        state.selectedDate = start
                    },
                )
            }

            // The page already says "Today" once, in its headline; only another day needs naming.
            if (state.selectedDate != today) {
                item(key = "day-title") {
                    T(
                        state.selectedDate.longLabel(), serif(24, italic = true),
                        Modifier.padding(top = 44.dp).rise(key = state.selectedDate, durationMs = 500, distance = 10),
                    )
                }
            } else {
                item(key = "day-gap") { Spacer(Modifier.height(18.dp)) }
            }

            val dayKey = state.selectedDate.iso()
            if (items.planned.isEmpty() && items.confirmed.isEmpty()) {
                item(key = "empty-$dayKey") {
                    EmptyDay(Modifier.padding(top = 38.dp).rise(key = dayKey)) { state.openAdd(AddRequest(state.selectedDate)) }
                }
            }
            if (items.planned.isNotEmpty()) {
                item(key = "planned-label") { ListHeading("Planned", items.planned.size, Modifier.animateItem().padding(top = 26.dp)) }
                itemsIndexed(items.planned, key = { _, tx -> tx.id }) { index, tx ->
                    TxRow(
                        snapshot, tx, today,
                        Modifier.animateItem(placementSpec = tween(400, easing = Motion.Out)).padding(top = 20.dp).rise(index * 60, key = dayKey),
                        onClick = { state.openMenu(tx) },
                        onSwipeRight = { state.repo.markPaid(tx) },
                        onSwipeLeft = if (tx.scheduleId != null) ({ state.repo.skip(tx) }) else null,
                    )
                }
            }
            if (items.confirmed.isNotEmpty()) {
                item(key = "confirmed-label") {
                    ListHeading("Confirmed", items.confirmed.size, Modifier.animateItem().padding(top = if (items.planned.isEmpty()) 26.dp else 34.dp))
                }
                itemsIndexed(items.confirmed, key = { _, tx -> tx.id }) { index, tx ->
                    TxRow(
                        snapshot, tx, today,
                        Modifier.animateItem(placementSpec = tween(400, easing = Motion.Out)).padding(top = 20.dp).rise((items.planned.size + index) * 60, key = dayKey),
                        onClick = { state.openMenu(tx) }, onSwipeRight = null, onSwipeLeft = null,
                    )
                }
            }
        }
    }
}

@Composable
private fun ListHeading(title: String, count: Int, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
        Label(title)
        T(count.toString(), sans(13), color = LocalPalette.current.mute)
    }
}

/**
 * One transaction: at most two lines. Swiping right confirms a plan, swiping left skips a
 * recurring occurrence; the action fires once the row passes a third of its width.
 */
@Composable
fun TxRow(
    snapshot: Snapshot,
    tx: Tx,
    today: LocalDate,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
    onSwipeRight: (() -> Unit)?,
    onSwipeLeft: (() -> Unit)?,
) {
    val palette = LocalPalette.current
    val haptics = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()
    val offset = remember(tx.id) { Animatable(0f) }
    var armed by remember(tx.id) { mutableStateOf(0) }
    val overdue = tx.status == "planned" && tx.occurredAt < today.iso()

    BoxWithConstraints(modifier.fillMaxWidth()) {
        val threshold = constraints.maxWidth * .28f
        val swipeable = onSwipeRight != null || onSwipeLeft != null
        if (swipeable && offset.value != 0f) {
            val right = offset.value > 0
            Box(Modifier.matchParentSize(), contentAlignment = if (right) Alignment.CenterStart else Alignment.CenterEnd) {
                T(if (right) "Paid" else "Skip", sans(14, 500), color = if (armed != 0) palette.terraInk else palette.mute)
            }
        }
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .graphicsLayer { translationX = offset.value }
                .then(
                    if (swipeable) Modifier.draggable(
                        orientation = Orientation.Horizontal,
                        state = rememberDraggableState { delta ->
                            val next = (offset.value + delta).let { value ->
                                when {
                                    value > 0 && onSwipeRight == null -> 0f
                                    value < 0 && onSwipeLeft == null -> 0f
                                    else -> value.coerceIn(-threshold * 1.4f, threshold * 1.4f)
                                }
                            }
                            val nowArmed = if (next >= threshold) 1 else if (next <= -threshold) -1 else 0
                            if (nowArmed != armed) {
                                armed = nowArmed
                                if (nowArmed != 0) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                            }
                            scope.launch { offset.snapTo(next) }
                        },
                        onDragStopped = {
                            val fired = armed
                            armed = 0
                            offset.animateTo(0f, tween(350, easing = Motion.Out))
                            if (fired > 0) onSwipeRight?.invoke() else if (fired < 0) onSwipeLeft?.invoke()
                        },
                    ) else Modifier,
                )
                .tap(scale = .98f, label = "Actions", onClick = onClick),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            CategoryGlyph(snapshot.txIcon(tx))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.Bottom) {
                    T(snapshot.txTitle(tx), sans(17, 500), Modifier.weight(1f).alignByBaseline().padding(end = 12.dp), maxLines = 1)
                    if (tx.scheduleId != null) PathIcon(Glyph.REPEAT, Modifier.padding(end = 6.dp).align(Alignment.CenterVertically), size = 16.dp, viewport = 16f)
                    val sign = tx.kind == "income"
                    MoneyText(formatAmount(tx.amount, signed = sign), snapshot.txCurrency(tx), Modifier.alignByBaseline(), style = sans(17, if (sign) 600 else 500))
                }
                val meta = snapshot.txMeta(tx).let { if (overdue) "Overdue · ${parseShort(tx.occurredAt)}${if (it.isEmpty()) "" else " · $it"}" else it }
                if (meta.isNotEmpty()) T(meta, sans(14), color = if (overdue) palette.terraInk else palette.mute, maxLines = 1)
            }
        }
    }
}

private fun parseShort(date: String): String = runCatching { LocalDate.parse(date).shortLabel() }.getOrDefault(date)

/** Four days with a 2dp marker that slides between them and overshoots once. */
@Composable
private fun DayStrip(
    days: List<LocalDate>,
    selected: LocalDate,
    today: LocalDate,
    counts: Map<String, DayCount>,
    modifier: Modifier = Modifier,
    onPick: (LocalDate) -> Unit,
    onShift: (Int) -> Unit,
) {
    val palette = LocalPalette.current
    val index = days.indexOf(selected)
    BoxWithConstraints(
        modifier.fillMaxWidth().drawBehind {
            drawLine(palette.line, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx())
        }.pointerInput(days.first()) {
            var travelled = 0f
            detectHorizontalDragGestures(
                onDragStart = { travelled = 0f },
                onDragEnd = { if (travelled < -80f) onShift(1) else if (travelled > 80f) onShift(-1) },
            ) { _, amount -> travelled += amount }
        },
    ) {
        val cell = maxWidth / days.size
        Row(Modifier.fillMaxWidth()) {
            days.forEach { day ->
                val isSelected = day == selected
                val isToday = day == today
                val count = counts[day.iso()]
                Column(
                    Modifier.weight(1f).tap(haptic = true, label = day.longLabel()) { onPick(day) }.padding(top = 4.dp, bottom = 10.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    T(day.weekdayShort(), sans(12, 500), color = if (isToday) palette.terraInk else palette.mute, maxLines = 1)
                    val ink by animateColorAsState(if (isToday) Color(0xFF191919) else if (isSelected) palette.ink else palette.mute, tween(300), label = "dayInk")
                    Box(Modifier.size(34.dp).background(if (isToday) palette.terra else Color.Transparent, CircleShape), contentAlignment = Alignment.Center) {
                        T(day.dayOfMonth.toString(), serif(21, lineHeight = 1f), color = ink, maxLines = 1)
                    }
                    Row(Modifier.height(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        if (count != null && count.planned > 0) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Box(Modifier.size(7.dp).border(1.5.dp, palette.terraInk, CircleShape))
                                T(count.planned.toString(), sans(12), color = palette.mute)
                            }
                        }
                        if (count != null && count.recorded > 0) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                Box(Modifier.size(6.dp).background(palette.mute, CircleShape))
                                T(count.recorded.toString(), sans(12), color = palette.mute)
                            }
                        }
                    }
                }
            }
        }
        if (index >= 0) {
            val x by animateDpAsState(cell * index, tween(if (LocalReduceMotion.current) 0 else Motion.INDICATOR, easing = Motion.Spring), label = "dayMarker")
            Box(Modifier.align(Alignment.BottomStart).offset(x = x, y = 1.dp).size(cell, 2.dp).background(palette.ink))
        }
    }
}

/** A month you can swipe sideways through. Dots repeat the strip's vocabulary: ring planned, dot recorded. */
@Composable
fun MonthCalendar(
    selected: LocalDate?,
    today: LocalDate,
    counts: Map<String, DayCount>,
    modifier: Modifier = Modifier,
    initialMonth: YearMonth = YearMonth.from(selected ?: today),
    onPick: (LocalDate) -> Unit,
) {
    val palette = LocalPalette.current
    var month by remember { mutableStateOf(initialMonth) }
    LaunchedEffect(selected) { if (selected != null && YearMonth.from(selected) != month) month = YearMonth.from(selected) }
    Column(
        modifier.fillMaxWidth().pointerInput(Unit) {
            var travelled = 0f
            detectHorizontalDragGestures(
                onDragStart = { travelled = 0f },
                onDragEnd = { if (travelled < -70f) month = month.plusMonths(1) else if (travelled > 70f) month = month.minusMonths(1) },
            ) { _, amount -> travelled += amount }
        },
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            T(month.atDay(1).monthYear(), serif(22, italic = true), Modifier.rise(key = month, durationMs = 400, distance = 8))
            Row(Modifier.offset(x = 12.dp)) {
                Box(Modifier.size(44.dp).graphicsLayer { rotationZ = 180f }.tap(label = "Previous month") { month = month.minusMonths(1) }, contentAlignment = Alignment.Center) {
                    PathIcon(Glyph.CHEVRON, size = 18.dp, viewport = 18f, stroke = 1.6.dp)
                }
                Box(Modifier.size(44.dp).tap(label = "Next month") { month = month.plusMonths(1) }, contentAlignment = Alignment.Center) {
                    PathIcon(Glyph.CHEVRON, size = 18.dp, viewport = 18f, stroke = 1.6.dp)
                }
            }
        }
        Row(
            Modifier.fillMaxWidth().drawBehind { drawLine(palette.line, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx()) }.padding(bottom = 8.dp),
        ) {
            listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun").forEachIndexed { i, name ->
                T(name, sans(12, 500), Modifier.weight(1f), if (i >= 5) palette.terraInk else palette.mute, maxLines = 1, align = TextAlign.Center)
            }
        }
        val first = month.atDay(1)
        val lead = (first.dayOfWeek.value - DayOfWeek.MONDAY.value + 7) % 7
        val cells = lead + month.lengthOfMonth()
        val rows = (cells + 6) / 7
        Column(Modifier.rise(key = month, durationMs = 400, distance = 8), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            for (row in 0 until rows) {
                Row(Modifier.fillMaxWidth()) {
                    for (column in 0 until 7) {
                        val dayNumber = row * 7 + column - lead + 1
                        if (dayNumber < 1 || dayNumber > month.lengthOfMonth()) {
                            Spacer(Modifier.weight(1f).height(46.dp))
                            continue
                        }
                        val date = month.atDay(dayNumber)
                        val isSelected = date == selected
                        val isToday = date == today
                        val count = counts[date.iso()]
                        val ring by animateColorAsState(if (isSelected && !isToday) palette.ink else Color.Transparent, tween(300), label = "ring")
                        Column(
                            Modifier.weight(1f).height(46.dp).tap(haptic = true, label = date.longLabel()) { onPick(date) },
                            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
                        ) {
                            Box(
                                Modifier.size(32.dp).background(if (isToday) palette.terra else Color.Transparent, CircleShape).border(1.5.dp, ring, CircleShape),
                                contentAlignment = Alignment.Center,
                            ) {
                                T(
                                    dayNumber.toString(), sans(15, if (isToday || isSelected) 600 else 400),
                                    color = if (isToday) Color(0xFF191919) else if (column >= 5) palette.terraInk else palette.ink, maxLines = 1,
                                )
                            }
                            Spacer(Modifier.height(3.dp))
                            Box(
                                Modifier.size(5.dp).then(
                                    when {
                                        count == null -> Modifier
                                        count.planned > 0 -> Modifier.border(1.dp, palette.terraInk, CircleShape)
                                        count.recorded > 0 -> Modifier.background(palette.mute, CircleShape)
                                        else -> Modifier
                                    },
                                ),
                            )
                        }
                    }
                }
            }
        }
    }
}

/** Empty day: three arches draw in turn, the terracotta sun rises behind the horizon and floats. */
@Composable
fun EmptyDay(modifier: Modifier = Modifier, title: String = "A clear day.", body: String = "Nothing planned and nothing recorded.", action: String? = "Add a transaction", onAdd: () -> Unit = {}) {
    val palette = LocalPalette.current
    val reduce = LocalReduceMotion.current
    val arcs = remember { List(3) { Animatable(if (reduce) 1f else 0f) } }
    val sun = remember { Animatable(if (reduce) 1f else 0f) }
    LaunchedEffect(Unit) {
        if (reduce) return@LaunchedEffect
        arcs.forEachIndexed { i, arc -> launch { kotlinx.coroutines.delay(100L + i * 150L); arc.animateTo(1f, tween(1700, easing = Motion.Out)) } }
        launch { kotlinx.coroutines.delay(600); sun.animateTo(1f, tween(2200, easing = Motion.Out)) }
    }
    val drift = if (reduce) 0f else {
        val transition = rememberInfiniteTransition(label = "float")
        val value by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(2250, delayMillis = 0), RepeatMode.Reverse), label = "float")
        value
    }
    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Canvas(Modifier.size(300.dp, 172.dp)) {
            val unit = size.width / 300f
            val stroke = Stroke(1.25.dp.toPx(), cap = StrokeCap.Round)
            val tint = palette.mute.copy(alpha = .55f)
            val horizon = 160f * unit
            // The sun is clipped by the horizon while it rises.
            val rise = sun.value
            val sunY = (126f + (1f - rise) * 36f) * unit - (if (rise >= 1f) drift * 6.dp.toPx() else 0f)
            drawContext.canvas.save()
            drawContext.canvas.clipRect(0f, 0f, size.width, horizon)
            drawCircle(palette.terra.copy(alpha = rise.coerceIn(0f, 1f)), 11f * unit, Offset(150f * unit, sunY))
            drawContext.canvas.restore()
            listOf(140f, 100f, 60f).forEachIndexed { i, radius ->
                val path = Path().apply {
                    arcTo(androidx.compose.ui.geometry.Rect(Offset(150f * unit, horizon), radius * unit), 180f, 180f, true)
                }
                val measure = PathMeasure().apply { setPath(path, false) }
                val drawn = Path()
                measure.getSegment(0f, measure.length * arcs[i].value, drawn, true)
                drawPath(drawn, tint, style = stroke)
            }
            drawLine(tint, Offset(0f, horizon), Offset(size.width, horizon), 1.25.dp.toPx(), StrokeCap.Round)
        }
        Spacer(Modifier.height(24.dp))
        T(title, serif(28, lineHeight = 1.1f, tracking = -.015f), align = TextAlign.Center)
        Spacer(Modifier.height(6.dp))
        T(body, sans(15), color = palette.mute, align = TextAlign.Center)
        if (action != null) {
            Box(Modifier.padding(top = 6.dp).heightIn(min = 44.dp).tap(onClick = onAdd).padding(horizontal = 12.dp), contentAlignment = Alignment.Center) {
                T(action, sans(15, 500), color = palette.terraInk)
            }
        }
    }
}
