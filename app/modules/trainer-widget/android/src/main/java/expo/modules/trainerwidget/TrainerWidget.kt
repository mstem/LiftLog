package expo.modules.trainerwidget

import android.content.Context
import android.content.Intent
import android.content.res.Resources
import android.net.Uri
import android.widget.RemoteViews
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.datastore.preferences.core.Preferences
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.currentState
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.ColumnScope
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.state.PreferencesGlanceStateDefinition
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import java.util.Locale

/** Layout A from the design: the next session on top, the week's three totals under it.
 * The 2x2 size keeps the next session and the kilometers. Text only, light only. */
class TrainerWidget : GlanceAppWidget() {
    companion object {
        val WIDE = DpSize(250.dp, 110.dp)
        val SMALL = DpSize(110.dp, 110.dp)
    }

    override val stateDefinition = PreferencesGlanceStateDefinition
    override val sizeMode: SizeMode = SizeMode.Responsive(setOf(WIDE, SMALL))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            val prefs = currentState<Preferences>()
            val ctx = LocalContext.current
            val payload = currentPayload(prefs[WidgetState.PAYLOAD], prefs[WidgetState.PAYLOAD_URL], WidgetConfig.url(ctx))
            val view = widgetView(WidgetConfig.configured(ctx), payload, System.currentTimeMillis(), copyFrom(ctx.resources))
            val wide = LocalSize.current.width >= WIDE.width
            Column(
                modifier = GlanceModifier.fillMaxSize().appWidgetBackground().background(BACKGROUND)
                    .cornerRadius(12.dp).padding(14.dp).clickable(actionStartActivity(openIntent(ctx))),
            ) {
                if (wide) Wide(view) else Small(view)
            }
        }
    }

    override fun onCompositionError(context: Context, glanceId: GlanceId, appWidgetId: Int, throwable: Throwable) {
        val views = RemoteViews(context.packageName, android.R.layout.simple_list_item_1)
        views.setTextViewText(android.R.id.text1, context.getString(R.string.widget_waiting))
        val open = android.app.PendingIntent.getActivity(
            context, 0, openIntent(context),
            android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT,
        )
        views.setOnClickPendingIntent(android.R.id.text1, open)
        android.appwidget.AppWidgetManager.getInstance(context).updateAppWidget(appWidgetId, views)
    }
}

private val BACKGROUND = Color(0xFFFFFFFF)
private val TEXT = ColorProvider(Color(0xFF1A1D23))
private val SECONDARY = ColorProvider(Color(0xFF4B5563))
private val MUTED = ColorProvider(Color(0xFF6B7280))

private fun openIntent(ctx: Context): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse("liftlog:///"))
        .setPackage(ctx.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

private fun copyFrom(res: Resources) = Copy(
    notConfigured = res.getString(R.string.widget_not_configured),
    waiting = res.getString(R.string.widget_waiting),
    today = res.getString(R.string.widget_today),
    tomorrow = res.getString(R.string.widget_tomorrow),
    updated = res.getString(R.string.widget_updated),
    ran = res.getString(R.string.widget_ran),
    lifted = res.getString(R.string.widget_lifted),
    active = res.getString(R.string.widget_active),
    km = res.getString(R.string.widget_km),
    kg = res.getString(R.string.widget_kg),
    min = res.getString(R.string.widget_min),
)

@Composable
private fun Caption(text: String?) {
    if (text != null) {
        Text(text.uppercase(Locale.US), style = TextStyle(color = MUTED, fontSize = 11.sp, fontWeight = FontWeight.Medium), maxLines = 1)
    }
}

@Composable
private fun Headline(text: String, maxLines: Int) {
    Text(text, style = TextStyle(color = TEXT, fontSize = 20.sp, fontWeight = FontWeight.Medium), maxLines = maxLines)
}

@Composable
private fun TotalColumn(total: Total, modifier: GlanceModifier = GlanceModifier) {
    Column(modifier = modifier) {
        Row(verticalAlignment = Alignment.Bottom) {
            Text(total.number, style = TextStyle(color = TEXT, fontSize = 20.sp, fontWeight = FontWeight.Medium), maxLines = 1)
            Spacer(GlanceModifier.width(2.dp))
            Text(total.unit, style = TextStyle(color = MUTED, fontSize = 12.sp), maxLines = 1)
        }
        Text(total.label, style = TextStyle(color = MUTED, fontSize = 11.sp), maxLines = 1)
    }
}

@Composable
private fun ColumnScope.Wide(view: WidgetView) {
    Caption(view.caption)
    Headline(view.headline, maxLines = if (view.totals.isEmpty()) 2 else 1)
    if (view.line != null) {
        Text(view.line, style = TextStyle(color = SECONDARY, fontSize = 13.sp), maxLines = 1)
    }
    Spacer(GlanceModifier.defaultWeight())
    if (view.totals.isNotEmpty()) {
        Row(modifier = GlanceModifier.fillMaxWidth()) {
            for (total in view.totals) {
                TotalColumn(total, GlanceModifier.defaultWeight())
            }
        }
    }
}

@Composable
private fun ColumnScope.Small(view: WidgetView) {
    Caption(view.caption)
    Headline(view.headline, maxLines = 2)
    Spacer(GlanceModifier.defaultWeight())
    view.totals.firstOrNull()?.let { TotalColumn(it) }
}
