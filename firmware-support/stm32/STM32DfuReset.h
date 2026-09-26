/*
 * STM32DfuReset.h - lets the web flasher restart an STM32 board into the
 * chip's built-in USB DFU bootloader, so no BOOT0 button is needed.
 *
 * For STM32duino (Arduino_Core_STM32) sketches built with
 * "USB support: CDC (generic 'Serial' supersede U(S)ART)".
 *
 *   #include "STM32DfuReset.h"
 *
 *   void loop() {
 *     stm32DfuResetPoll();
 *     ...
 *   }
 *
 * The flasher opens the board's serial port at 1200 baud and closes it (the
 * Arduino "1200 bps touch"). When that happens this code stops USB, resets
 * the clocks and interrupts, and jumps to the system memory bootloader, which
 * enumerates as "STM32 BOOTLOADER" (0483:df11).
 *
 * System memory is at 0x1FFF0000 on STM32F4 (F401, F411) and STM32G4. For
 * other families, check ST application note AN2606 and define
 * STM32_SYSMEM_BASE before including this file.
 */
#pragma once

#include <Arduino.h>

extern "C" {
#include "usbd_cdc.h"
// Both are defined in the core's usbd_cdc_if.c.
extern USBD_CDC_LineCodingTypeDef linecoding;
extern __IO bool dtrState;
}

#ifndef STM32_SYSMEM_BASE
#define STM32_SYSMEM_BASE 0x1FFF0000UL
#endif

[[noreturn]] static void stm32JumpToSystemBootloader() {
  // Stop USB first so the host sees a disconnect before the bootloader enumerates.
  Serial.end();
  delay(20);

  __disable_irq();
  SysTick->CTRL = 0;
  SysTick->LOAD = 0;
  SysTick->VAL = 0;
  HAL_RCC_DeInit();
  HAL_DeInit();  // also resets the USB peripheral
  for (uint32_t i = 0; i < sizeof(NVIC->ICER) / sizeof(NVIC->ICER[0]); i++) {
    NVIC->ICER[i] = 0xFFFFFFFF;
    NVIC->ICPR[i] = 0xFFFFFFFF;
  }
  __HAL_RCC_SYSCFG_CLK_ENABLE();
  __HAL_SYSCFG_REMAPMEMORY_SYSTEMFLASH();
  __enable_irq();

  const uint32_t sp = *(volatile uint32_t *)STM32_SYSMEM_BASE;
  const uint32_t pc = *(volatile uint32_t *)(STM32_SYSMEM_BASE + 4);
  __set_MSP(sp);
  ((void (*)(void))pc)();
  for (;;) {
  }
}

/** Call from loop(): jumps to the DFU bootloader after a 1200 baud touch. */
inline void stm32DfuResetPoll() {
  if (linecoding.bitrate == 1200 && !dtrState) stm32JumpToSystemBootloader();
}
