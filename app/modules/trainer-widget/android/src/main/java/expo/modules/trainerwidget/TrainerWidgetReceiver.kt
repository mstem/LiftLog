package expo.modules.trainerwidget

import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver

class TrainerWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TrainerWidget()

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        WidgetWork.schedulePeriodic(context)
        WidgetWork.refreshNow(context)
    }
}
