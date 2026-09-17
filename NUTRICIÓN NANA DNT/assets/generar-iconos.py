#!/usr/bin/env python3
"""Genera los iconos de NANA DNT a partir del logotipo original.

    python3 assets/generar-iconos.py        (desde la carpeta del módulo)

El logotipo del aplicativo es el lockup completo —recuadro azul, emblema,
insignia de PascalIA y la palabra NANA DNT—, tal como lo entregó la
Coordinación. Todas las pantallas usan ese mismo archivo: no hay una versión
recortada para el encabezado.

Lo único que cambia entre salidas es el recorte de las esquinas:

  redondeado  el recuadro conserva su curva y las esquinas van transparentes.
              Sirve donde el logotipo se posa sobre el fondo de la página.
  a sangre    el azul llega hasta el borde. Es lo que necesitan los iconos de
              pantalla de inicio: iOS y Android aplican su propia máscara, y un
              borde transparente se vería como un halo alrededor del icono.

La máscara redondeada se encoge dos píxeles porque el archivo original trae una
hebra blanca sobre la curva, resto de haberlo recortado contra fondo claro.
"""

from PIL import Image, ImageDraw, ImageFilter

ORIGEN = 'assets/nana-dnt-logo-original.png'
NAVY = (12, 40, 88, 255)
RADIO = 86 / 512      # el redondeo del recuadro original, en proporción del lado


def silueta(lado, redondeado=True):
    m = Image.new('L', (lado, lado), 0)
    d = ImageDraw.Draw(m)
    if redondeado:
        d.rounded_rectangle([0, 0, lado - 1, lado - 1], radius=round(lado * RADIO), fill=255)
        m = m.filter(ImageFilter.MinFilter(5))   # deja fuera la hebra blanca del borde
    else:
        d.rectangle([0, 0, lado - 1, lado - 1], fill=255)
    return m


def logotipo(origen, lado, redondeado=True):
    # El azul de fondo se pone debajo: al ir a sangre, las esquinas que en el
    # original eran transparentes tienen que quedar azules, no huecas.
    fondo = Image.new('RGBA', origen.size, NAVY)
    plano = Image.alpha_composite(fondo, origen.convert('RGBA'))
    salida = plano.resize((lado, lado), Image.LANCZOS)
    salida.putalpha(silueta(lado, redondeado))
    return salida


def principal():
    origen = Image.open(ORIGEN)
    print('origen %s %s\n' % (ORIGEN, origen.size))

    salidas = [
        ('assets/nana-dnt-logo.png', 512, True,  'encabezado, ingreso y tarjeta del portal'),
        ('assets/icono-32.png',       32, True,  'pestaña del navegador'),
        ('assets/icono-180.png',     180, False, 'pantalla de inicio de iOS'),
        ('assets/icono-192.png',     192, False, 'pantalla de inicio de Android'),
    ]
    for ruta, lado, redondeado, para in salidas:
        logotipo(origen, lado, redondeado).save(ruta, optimize=True)
        print('  %-28s %3d px  %-11s %s' % (ruta, lado,
              'redondeado' if redondeado else 'a sangre', para))


if __name__ == '__main__':
    principal()
