package com.byemidias.player.ui.activation

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.byemidias.player.ByeMidiasApp
import com.byemidias.player.ui.player.PlayerActivity
import kotlinx.coroutines.launch

class ActivationActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                ActivationScreen()
            }
        }
    }
}

@Composable
fun ActivationScreen() {
    val context = LocalContext.current
    val app = context.applicationContext as ByeMidiasApp
    val repo = app.deviceRepository
    val scope = rememberCoroutineScope()

    var activationCode by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val deviceUuid = remember { repo.getDeviceUuid() }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF111827))
            .padding(48.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            Text(
                text = "ByeMidias",
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )

            Text(
                text = "Ative este dispositivo",
                fontSize = 20.sp,
                color = Color(0xFF9CA3AF)
            )

            // Device UUID display
            Card(
                modifier = Modifier.fillMaxWidth(0.5f),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2937))
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Device ID",
                        fontSize = 12.sp,
                        color = Color(0xFF6B7280)
                    )
                    Text(
                        text = deviceUuid,
                        fontSize = 16.sp,
                        fontFamily = FontFamily.Monospace,
                        color = Color(0xFF60A5FA)
                    )
                }
            }

            // Activation code input
            OutlinedTextField(
                value = activationCode,
                onValueChange = { activationCode = it.uppercase() },
                label = { Text("Código de ativação") },
                modifier = Modifier.fillMaxWidth(0.5f),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = Color(0xFF3B82F6),
                    unfocusedBorderColor = Color(0xFF4B5563),
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    cursorColor = Color(0xFF3B82F6)
                )
            )

            if (error != null) {
                Text(
                    text = error!!,
                    color = Color(0xFFEF4444),
                    fontSize = 14.sp
                )
            }

            Button(
                onClick = {
                    if (activationCode.isBlank()) {
                        error = "Informe o código de ativação"
                        return@Button
                    }
                    loading = true
                    error = null
                    scope.launch {
                        val result = repo.activateDevice(activationCode)
                        loading = false
                        if (result.isSuccess) {
                            context.startActivity(Intent(context, PlayerActivity::class.java))
                            (context as? ComponentActivity)?.finish()
                        } else {
                            error = result.exceptionOrNull()?.message ?: "Erro ao ativar"
                        }
                    }
                },
                enabled = !loading && activationCode.isNotBlank(),
                modifier = Modifier
                    .fillMaxWidth(0.5f)
                    .height(56.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF3B82F6))
            ) {
                if (loading) {
                    CircularProgressIndicator(
                        color = Color.White,
                        modifier = Modifier.size(24.dp)
                    )
                } else {
                    Text("Ativar", fontSize = 16.sp, fontWeight = FontWeight.Medium)
                }
            }
        }
    }
}
