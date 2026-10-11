package com.keynest.vault

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

/**
 * KeyNest Native Android Client Activity
 * Simple 3-tab navigation: Personal, Shared, Categories
 * Reuses the documented KeyNest REST API and zero-knowledge encryption contract.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFFF8FAFC)
                ) {
                    KeyNestApp()
                }
            }
        }
    }
}

enum class VaultTab {
    PERSONAL,
    SHARED,
    CATEGORIES
}

@Composable
fun KeyNestApp() {
    var currentTab by remember { mutableStateOf(VaultTab.PERSONAL) }

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = Color.White
            ) {
                NavigationBarItem(
                    selected = currentTab == VaultTab.PERSONAL,
                    onClick = { currentTab = VaultTab.PERSONAL },
                    label = { Text("Personal") },
                    icon = { Text("🔒") }
                )
                NavigationBarItem(
                    selected = currentTab == VaultTab.SHARED,
                    onClick = { currentTab = VaultTab.SHARED },
                    label = { Text("Shared") },
                    icon = { Text("👥") }
                )
                NavigationBarItem(
                    selected = currentTab == VaultTab.CATEGORIES,
                    onClick = { currentTab = VaultTab.CATEGORIES },
                    label = { Text("Categories") },
                    icon = { Text("📁") }
                )
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when (currentTab) {
                VaultTab.PERSONAL -> VaultTabContent("Personal passwords", "A private place for your own logins.")
                VaultTab.SHARED -> VaultTabContent("Shared passwords", "Logins shared with selected teammates.")
                VaultTab.CATEGORIES -> VaultTabContent("My categories", "User-created categories to organize logins.")
            }
        }
    }
}

@Composable
fun VaultTabContent(title: String, subtitle: String) {
    Column(
        modifier = Modifier.fillMaxSize()
    ) {
        Text(text = title, style = MaterialTheme.typography.headlineMedium)
        Text(text = subtitle, style = MaterialTheme.typography.bodyMedium)
    }
}
