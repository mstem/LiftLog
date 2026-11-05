package expo.modules.trainerwidget

import android.content.Context

/** Where to fetch the widget file and with which key: the remote backup endpoint's
 * origin plus /widget and the backup's API key, handed over by the app. */
object WidgetConfig {
    private const val FILE = "trainer_widget"
    private const val URL = "url"
    private const val KEY = "api_key"

    private fun prefs(ctx: Context) = ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun save(ctx: Context, url: String?, key: String?) {
        prefs(ctx).edit().putString(URL, url?.trim()).putString(KEY, key?.trim()).apply()
    }

    fun url(ctx: Context): String? = prefs(ctx).getString(URL, null)

    fun key(ctx: Context): String? = prefs(ctx).getString(KEY, null)

    fun configured(ctx: Context): Boolean = !url(ctx).isNullOrBlank() && !key(ctx).isNullOrBlank()
}
