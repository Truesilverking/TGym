package app.framegym.mobile;
import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;
/** System-visible rationale; no private profile data is exposed by this activity. */
public class HealthPermissionsActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        TextView text=new TextView(this);int padding=(int)(24*getResources().getDisplayMetrics().density);text.setPadding(padding,padding,padding,padding);text.setTextSize(18);
        boolean es=java.util.Locale.getDefault().getLanguage().equals("es");
        text.setText(es ? "TGym • Health Connect\n\nCon tu permiso, TGym lee las sesiones de ejercicio de los últimos 30 días al pulsar Sincronizar. Guarda tipo, duración y origen junto a tu historial local y los incluye en tus copias de seguridad. No lee rutas GPS ni escribe datos de salud.\n\nDesconectar detiene la sincronización y conserva el historial importado. Puedes revocar el permiso en los ajustes de Health Connect. Puedes usar TGym sin este permiso." : "TGym • Health Connect\n\nWith your permission, TGym reads exercise sessions from the last 30 days when you tap Sync. Type, duration and source are stored in your local history and included in your backups. TGym does not read GPS routes or write health data.\n\nDisconnect stops synchronization and keeps imported history. Revoke permission in Health Connect settings. You can use TGym without this permission.");setContentView(text);
    }
}
