#!/usr/bin/env python3
"""Genera los iconos de NANA DNT a partir del logotipo original.

    python3 assets/generar-iconos.py        (desde la carpeta del módulo)

Por qué existe
--------------
El «símbolo» del encabezado se había recortado a ojo del lockup completo y se
llevaba media insignia de PascalIA en la esquina: en 46 px eso se veía como un
recuadro blanco con un pedazo de palabra. Y el recorte redondeado dejaba un
filete blanco de un píxel sobre la curva de las esquinas.

Aquí el recuadro azul se dibuja de cero y el emblema se localiza por su
contenido real, así que ninguna de las dos cosas puede volver a pasar. La firma
de PascalIA no se pierde: va al pie de todas las pantallas y dentro del lockup
grande de la pantalla de ingreso.
"""

from PIL import Image, ImageDraw, ImageFilter

ORIGEN = 'assets/nana-dnt-logo-original.png'   # el lockup tal como llegó
NAVY = (12, 40, 88, 255)
RADIO = 86 / 512     # el redondeo del recuadro original, en proporción del lado
OCUPA = 0.86         # cuánto del lado ocupa el emblema dentro del símbolo


def mascara(lado, redondeado=True):
    """Silueta del recuadro. Sin redondear va a sangre: iOS y Android aplican su
    propia máscara y un borde transparente se vería como un halo."""
    m = Image.new('L', (lado, lado), 0)
    d = ImageDraw.Draw(m)
    if redondeado:
        d.rounded_rectangle([0, 0, lado - 1, lado - 1], radius=round(lado * RADIO), fill=255)
    else:
        d.rectangle([0, 0, lado - 1, lado - 1], fill=255)
    return m


def recuadro(lado, redondeado=True):
    tela = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    tela.paste(NAVY, (0, 0, lado, lado), mascara(lado, redondeado))
    return tela


def emblema(origen):
    """El aro, el corazón, el niño y la cinta dorada: sin insignia y sin texto.

    Devuelve un recorte cuadrado centrado en el emblema, con su fondo azul.
    """
    im = origen.convert('RGBA').copy()
    w, h = im.size
    esc = w / 512

    # La insignia de PascalIA ocupa la esquina superior derecha y no toca el
    # emblema: entre las dos hay azul limpio. Se tapa antes de medir.
    ImageDraw.Draw(im).rectangle([round(366 * esc), 0, w - 1, round(150 * esc)], fill=NAVY)

    pix = im.load()
    # El emblema es claro sobre azul oscuro, así que la luminancia lo aísla. El
    # margen deja fuera el filete de las esquinas y la banda del texto.
    caja = (round(26 * esc), round(26 * esc), round(486 * esc), round(372 * esc))
    x0, y0, x1, y1 = w, h, -1, -1
    for y in range(caja[1], caja[3]):
        for x in range(caja[0], caja[2]):
            r, g, b, a = pix[x, y]
            if a > 128 and (0.299 * r + 0.587 * g + 0.114 * b) > 90:
                x0, x1 = min(x0, x), max(x1, x)
                y0, y1 = min(y0, y), max(y1, y)
    if x1 < 0:
        raise SystemExit('No se encontró el emblema en ' + ORIGEN)

    # Recorte cuadrado centrado: así el aro queda en el medio del recuadro
    # aunque la cinta dorada sea más ancha que alta.
    lado = max(x1 - x0, y1 - y0) + 1
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    rec = im.crop((round(cx - lado / 2), round(cy - lado / 2),
                   round(cx + lado / 2), round(cy + lado / 2)))
    return rec, (x0, y0, x1, y1)


def simbolo(origen, lado, redondeado=True):
    arte, _ = emblema(origen)
    med = round(lado * OCUPA)
    capa = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
    capa.paste(arte.resize((med, med), Image.LANCZOS), ((lado - med) // 2, (lado - med) // 2))
    tela = Image.alpha_composite(recuadro(lado, redondeado), capa)
    # El recorte trae su propio azul: recortarlo contra la silueta evita que
    # asome por las esquinas redondeadas.
    tela.putalpha(mascara(lado, redondeado))
    return tela


def lockup(origen, lado=512):
    """El logotipo completo —emblema, texto e insignia— sin el filete blanco.

    La máscara se encoge dos píxeles: el original traía una hebra blanca sobre
    la curva de las esquinas, resto de haberlo recortado contra fondo claro.
    """
    im = origen.convert('RGBA').resize((lado, lado), Image.LANCZOS)
    m = mascara(lado).filter(ImageFilter.MinFilter(5))
    im.putalpha(m)
    return im


def principal():
    origen = Image.open(ORIGEN)
    arte, (x0, y0, x1, y1) = emblema(origen)
    print('origen  %s %s' % (ORIGEN, origen.size))
    print('emblema x %d-%d  y %d-%d  →  recorte cuadrado %s' % (x0, x1, y0, y1, arte.size))
    print()

    salidas = [
        ('assets/nana-dnt-simbolo.png', 512, True,  'encabezado, tarjeta del portal y PDF'),
        ('assets/icono-32.png',          32, True,  'pestaña del navegador'),
        ('assets/icono-180.png',        180, False, 'pantalla de inicio de iOS'),
        ('assets/icono-192.png',        192, False, 'pantalla de inicio de Android'),
    ]
    for ruta, med, redondeado, para in salidas:
        simbolo(origen, med, redondeado).save(ruta, optimize=True)
        print('  %-30s %3d px  %-11s %s' % (ruta, med,
              'redondeado' if redondeado else 'a sangre', para))

    lockup(origen).save('assets/nana-dnt-logo.png', optimize=True)
    print('  %-30s %3d px  %-11s %s' % ('assets/nana-dnt-logo.png', 512,
          'redondeado', 'pantalla de ingreso, con la insignia'))


if __name__ == '__main__':
    principal()
