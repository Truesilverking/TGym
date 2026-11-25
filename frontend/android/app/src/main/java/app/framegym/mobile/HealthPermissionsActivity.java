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
        text.setText(es ? "TGym • Health Connect\n\nCon tu permiso, TGym puede leer sesiones de ejercicio y registros de peso de los últimos 30 días. Los permisos de ejercicio y peso se solicitan por separado. Guarda la medición, fecha y origen junto a tu historial local y los incluye en tus copias de seguridad. No lee rutas GPS ni escribe datos de salud.\n\nPuedes sincronizar manualmente. Si activas la sincronización automática de peso, TGym consulta los registros al abrir o volver a la app. El peso registrado hoy puede reutilizarse en tus rutinas del día.\n\nDesconectar detiene futuras importaciones y conserva el historial importado. Puedes revocar cada permiso en los ajustes de Health Connect. Puedes usar TGym sin estos permisos." : "TGym • Health Connect\n\nWith your permission, TGym can read exercise sessions and weight records from the last 30 days. Exercise and weight permissions are requested separately. Measurements, dates and sources are stored with your local history and included in your backups. TGym does not read GPS routes or write health data.\n\nYou can sync manually. If you enable automatic weight sync, TGym reads records when you open or return to the app. Today's recorded weight can be reused in the day's workouts.\n\nDisconnect stops future imports and keeps imported history. Revoke each permission in Health Connect settings. You can use TGym without these permissions.");setContentView(text);
    }
}
