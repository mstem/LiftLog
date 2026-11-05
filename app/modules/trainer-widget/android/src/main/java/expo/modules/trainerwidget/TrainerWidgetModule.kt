package expo.modules.trainerwidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** The app hands over where the widget file lives and asks for refreshes; everything
 * else (fetching, drawing) happens natively, with the app closed too. */
class TrainerWidgetModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("TrainerWidget")

        Function("setConfig") { url: String?, apiKey: String? ->
            appContext.reactContext?.applicationContext?.let { ctx ->
                WidgetConfig.save(ctx, url, apiKey)
                WidgetWork.schedulePeriodic(ctx)
                WidgetWork.refreshNow(ctx)
            }
        }

        Function("refresh") {
            appContext.reactContext?.applicationContext?.let { WidgetWork.refreshAfterBackup(it) }
        }

        // A tap on the widget opens the app, so this is the refresh on tap too.
        OnActivityEntersForeground {
            appContext.reactContext?.applicationContext?.let { WidgetWork.refreshNow(it) }
        }
    }
}
